export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.ASSEMBLY_KEY;
  if (!key) return res.status(500).json({ error: 'ASSEMBLY_KEY not configured' });

  try {
    const { audioUrl } = req.body;
    if (!audioUrl) return res.status(400).json({ error: 'audioUrl required' });

    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: audioUrl, language_code: 'pt' }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    res.json({ transcriptId: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
