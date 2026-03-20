export default async function handler(req, res) {
  const key = process.env.ASSEMBLY_KEY;
  if (!key) return res.status(500).json({ error: 'ASSEMBLY_KEY not configured' });

  const { transcriptId } = req.query;
  if (!transcriptId) return res.status(400).json({ error: 'transcriptId required' });

  try {
    const response = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      { headers: { 'Authorization': key } }
    );

    const data = await response.json();
    res.json({
      status: data.status,
      text: data.status === 'completed' ? data.text : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
