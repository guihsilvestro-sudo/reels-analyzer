export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });

  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: [username],
          resultsLimit: 200
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      const msg = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error || data);
      return res.status(response.status).json({ error: msg });
    }

    res.json({
      runId: data?.data?.id,
      datasetId: data?.data?.defaultDatasetId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
