export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });

  try {
    const { reelUrl } = req.body;
    if (!reelUrl) return res.status(400).json({ error: 'Cole o link do reel.' });

    // Clean and normalize the URL
    let url = reelUrl.trim();

    // Remove query parameters (?igsh=xxx, ?utm_source=xxx, etc)
    url = url.split('?')[0];

    // Remove trailing slash
    url = url.replace(/\/+$/, '');

    // If user pasted just a shortcode (no slashes, no dots)
    if (!url.includes('/') && !url.includes('.')) {
      url = 'https://www.instagram.com/reel/' + url;
    }

    // Add https:// if missing
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    // Add www. if missing
    url = url.replace('://instagram.com', '://www.instagram.com');

    // Convert /p/ to /reel/
    url = url.replace('/p/', '/reel/');

    // Validate it looks like an Instagram URL
    if (!url.includes('instagram.com')) {
      return res.status(400).json({ error: 'URL inválida. Cole um link do Instagram.' });
    }

    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: [url],
          resultsLimit: 1,
          downloadVideo: true,
          scrapeTranscripts: true,
          includeTranscript: true
        }),
      }
    );

    let data;
    try {
      data = await response.json();
    } catch (e) {
      return res.status(500).json({ error: 'Resposta inválida do Apify. Tente novamente.' });
    }

    if (!response.ok) {
      const msg = typeof data?.error === 'string'
        ? data.error
        : data?.error?.message || JSON.stringify(data?.error || data);
      return res.status(response.status).json({ error: msg });
    }

    if (!data?.data?.id) {
      return res.status(500).json({ error: 'Apify não retornou um ID de execução. Tente novamente.' });
    }

    res.json({
      runId: data.data.id,
      datasetId: data.data.defaultDatasetId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erro interno do servidor.' });
  }
}
