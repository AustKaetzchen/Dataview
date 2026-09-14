async function run() {
  console.log('Starting 1440p test render with bottom-center legend and zoom 2.71...')
  const resp = await fetch('http://localhost:5174/api/export/start-render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      concurrency: 1,
      endYear: -3000,
      filename: 'test_1440p_bottom_center.mp4',
      fps: 30,
      height: 1440,
      keyframesOnly: true,
      legendPosition: 'bottom-center',
      mode: 'stationary',
      outputFilename: 'test_1440p_bottom_center.mp4',
      projection: 'Equirectangular',
      selectedLayers: ['GDP_PPP'],
      startYear: -3000,
      timestepStep: 1,
      width: 2560,
      zoom: 2.71,
    }),
  })

  const job = await resp.json()
  console.log('Job submitted:', job)

  // Poll status until complete
  while (true) {
    await new Promise((r) => setTimeout(r, 1000))
    const statusResp = await fetch(`http://localhost:5174/api/export/status?jobId=${job.jobId}`)
    const status = await statusResp.json()
    console.log(`[${status.status}] ${status.progressPct}%: ${status.message}`)
    if (status.status === 'complete' || status.status === 'error' || status.status === 'cancelled') {
      console.log('Final status:', status)
      break
    }
  }
}

run()
