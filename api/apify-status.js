export default async function handler(req, res) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });

  const { runId } = req.query;
  if (!runId) return res.status(400).json({ error: 'runId required' });

  try {
    const response = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
    );
    const data = await response.json();
    res.json({ status: data?.data?.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
