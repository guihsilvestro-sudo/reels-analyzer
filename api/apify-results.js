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

    const enriched = items.map((item, index) => {
      const videoLog = [];
      const videoUrl = findVideoUrl(item, videoLog);
      const transcript = findTranscript(item);
      return {
        ...item,
        _videoUrl: videoUrl,
        _transcript: transcript,
        _debug: index === 0 ? { keys: Object.keys(item), videoLog, sample: summarize(item) } : undefined
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function summarize(obj) {
  const result = {};
  for (const [key, val] of Object.entries(obj || {})) {
    if (val === null || val === undefined) result[key] = 'null';
    else if (Array.isArray(val)) result[key] = `array[${val.length}]`;
    else if (typeof val === 'object') result[key] = `object{${Object.keys(val).join(',')}}`;
    else if (typeof val === 'string') result[key] = val.length > 100 ? val.slice(0, 100) + '...' : val;
    else result[key] = val;
  }
  return result;
}

function findVideoUrl(obj, log, depth = 0) {
  if (depth > 4 || !obj || typeof obj !== 'object') return null;

  // 1. Check all known direct field names
  const fields = [
    'videoUrl', 'video_url', 'videoURL', 'video',
    'downloadedVideo', 'downloadedVideoUrl', 'downloaded_video',
    'mediaUrl', 'media_url', 'mediaURL',
    'videoSrc', 'video_src', 'mp4Url',
    'contentUrl', 'content_url', 'sourceUrl',
    'playbackUrl', 'hlsUrl', 'streamUrl',
    'videoLink', 'video_link', 'displayUrl',
    'display_url', 'url'
  ];

  for (const f of fields) {
    if (typeof obj[f] === 'string' && obj[f].startsWith('http') && !obj[f].includes('/p/') && !obj[f].includes('instagram.com/reel')) {
      if (log) log.push(`Found in field "${f}": ${obj[f].slice(0, 120)}`);
      return obj[f];
    }
  }

  // 2. Check videoVersions array
  if (Array.isArray(obj.videoVersions) && obj.videoVersions.length > 0) {
    const v = obj.videoVersions[0];
    if (typeof v === 'string' && v.startsWith('http')) { if (log) log.push('Found in videoVersions[0]'); return v; }
    if (v && typeof v.url === 'string') { if (log) log.push('Found in videoVersions[0].url'); return v.url; }
    if (v && typeof v.src === 'string') { if (log) log.push('Found in videoVersions[0].src'); return v.src; }
  }

  // 3. Search for ANY string that looks like a video URL
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string' && val.startsWith('http') && (
      val.includes('.mp4') ||
      val.includes('/video/') ||
      val.includes('video_dashinit') ||
      val.includes('bytestart') ||
      val.includes('cdninstagram') ||
      val.includes('scontent')
    )) {
      if (log) log.push(`Found video-like URL in "${key}": ${val.slice(0, 120)}`);
      return val;
    }
  }

  // 4. Recurse into nested objects and arrays
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const found = findVideoUrl(val, log, depth + 1);
      if (found) return found;
    }
    if (Array.isArray(val) && val.length > 0 && val.length < 10) {
      for (let i = 0; i < val.length; i++) {
        if (typeof val[i] === 'object' && val[i] !== null) {
          const found = findVideoUrl(val[i], log, depth + 1);
          if (found) return found;
        }
        if (typeof val[i] === 'string' && val[i].startsWith('http') && (val[i].includes('.mp4') || val[i].includes('video'))) {
          if (log) log.push(`Found in ${key}[${i}]`);
          return val[i];
        }
      }
    }
  }

  if (depth === 0 && log) log.push('No video URL found in any field');
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
