import fs from 'fs'

async function run() {
  console.log('Fetching GDP_PPP for year -3000...')
  const gdpResp = await fetch('http://localhost:5174/api/raster/file?layer=GDP_PPP&year=-3000')
  const gdpBuf = Buffer.from(await gdpResp.arrayBuffer())
  console.log('GDP_PPP buffer size:', gdpBuf.length)

  console.log('Fetching population_total for year -3000...')
  const popResp = await fetch('http://localhost:5174/api/raster/file?layer=population_total&year=-3000')
  const popBuf = Buffer.from(await popResp.arrayBuffer())
  console.log('population_total buffer size:', popBuf.length)
}

run()
