export default async function handler(req, res) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });

  const { datasetId } = req.query;
  if (!datasetId) return res.status(400).json({ error: 'datasetId required' });

  try {
    const response = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=300`
    );
    if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch dataset' });

    const items = await response.json();

    const enriched = items.map(item => {
      const videoUrl = findVideoUrl(item);
      const transcript = findTranscript(item);
      return { ...item, _videoUrl: videoUrl, _transcript: transcript };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function findVideoUrl(obj, depth = 0) {
  if (depth > 4 || !obj || typeof obj !== 'object') return null;

  const fields = [
    'videoUrl', 'video_url', 'videoURL', 'video',
    'downloadedVideo', 'downloadedVideoUrl', 'downloaded_video',
    'mediaUrl', 'media_url', 'mediaURL',
    'videoSrc', 'video_src', 'mp4Url',
    'contentUrl', 'content_url', 'sourceUrl',
    'playbackUrl', 'hlsUrl', 'streamUrl',
    'videoLink', 'video_link'
  ];

  for (const f of fields) {
    if (typeof obj[f] === 'string' && obj[f].startsWith('http')) return obj[f];
  }

  if (Array.isArray(obj.videoVersions) && obj.videoVersions.length > 0) {
    const v = obj.videoVersions[0];
    if (typeof v === 'string' && v.startsWith('http')) return v;
    if (v && typeof v.url === 'string') return v.url;
  }

  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string' && val.startsWith('http') && (
      val.includes('.mp4') || val.includes('/video/') ||
      val.includes('video_dashinit') || val.includes('cdninstagram')
    )) return val;
  }

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const found = findVideoUrl(val, depth + 1);
      if (found) return found;
    }
    if (Array.isArray(val) && val.length > 0 && val.length < 10) {
      for (const item of val) {
        if (typeof item === 'object' && item !== null) {
          const found = findVideoUrl(item, depth + 1);
          if (found) return found;
        }
      }
    }
  }

  return null;
}

function findTranscript(obj, depth = 0) {
  if (depth > 4 || !obj || typeof obj !== 'object') return null;

  const fields = [
    'transcript', 'transcription', 'subtitles', 'captions',
    'closedCaptions', 'closed_captions', 'accessibility_caption',
    'accessibilityCaption', 'clipTranscription', 'transcriptText',
  ];

  for (const f of fields) {
    if (typeof obj[f] === 'string' && obj[f].length > 10) return obj[f];
  }

  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const found = findTranscript(val, depth + 1);
      if (found) return found;
    }
  }

  return null;
}
