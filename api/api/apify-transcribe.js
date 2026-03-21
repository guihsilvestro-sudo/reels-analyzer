export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });

  try {
    const { reelUrls } = req.body;
    if (!reelUrls || !reelUrls.length) return res.status(400).json({ error: 'reelUrls required' });

    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: reelUrls,
          resultsLimit: reelUrls.length,
          downloadVideo: true,
          scrapeTranscripts: true,
          includeTranscript: true
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
```

Commit changes.

**Passo 3 — Edita `public/index.html`** (lápis ✏️). Procura este trecho no código:
```
const STEPS=['Iniciar coleta','Coletar reels (1–5 min)','Baixar resultados','Filtrar Top 10','Transcrever áudio','Finalizar'];
```

Substitui por:
```
const STEPS=['Coletar reels','Aguardar coleta','Baixar resultados','Filtrar Top 10','Transcrever Top 10','Aguardar transcrição','Finalizar'];
```

Agora procura o trecho que começa com `// 5` (a etapa de transcrição). Vai ser algo como:
```
    // 5
    renderSteps(5);
    const need=top10.filter(r=>!r.transcription&&r.videoUrl);
```

Substitui **desde `// 5`** até **`// 6`** (não incluindo o `// 6`) por:
```
    // 5 — Send top 10 URLs for transcription via Apify
    renderSteps(5);
    const reelUrls=top10.filter(r=>r.url).map(r=>r.url);
    
    if(reelUrls.length>0){
      setStatus(`Enviando ${reelUrls.length} reels para transcrição...`);
      const txStartRes=await fetch('/api/apify-transcribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reelUrls})});
      const txStartData=await txStartRes.json();
      
      if(txStartRes.ok&&txStartData.runId){
        // 6 — Poll transcription run
        renderSteps(6);
        setStatus('Transcrevendo os Top 10... Pode levar alguns minutos.');
        while(true){
          await sleep(4000);
          const pollRes=await fetch(`/api/apify-status?runId=${txStartData.runId}`);
          const pollData=await pollRes.json();
          const s=pollData.status;
          if(s==='SUCCEEDED')break;
          if(s==='FAILED'||s==='ABORTED'||s==='TIMED-OUT'){setStatus('Transcrição falhou, mostrando sem.');break;}
          setStatus(s==='RUNNING'?'Transcrevendo...':'Status: '+s);
        }
        
        // Fetch transcription results and merge
        const txItemsRes=await fetch(`/api/apify-results?datasetId=${txStartData.datasetId}`);
        const txItems=await txItemsRes.json();
        
        if(txItems&&txItems.length>0){
          for(const reel of top10){
            const match=txItems.find(tx=>{
              const txUrl=tx.url||'';
              const txCode=tx.shortCode||tx.code||'';
              return (reel.url&&txUrl&&txUrl.includes(reel.url.split('/').filter(Boolean).pop()))||(txCode&&reel.url&&reel.url.includes(txCode));
            });
            if(match){
              const tx=match._transcript||match.transcript||match.transcription||null;
              if(tx){reel.transcription=tx;reel.txSource='apify';}
            }
          }
        }
      }
    }
