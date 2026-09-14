import { decode as decodePng } from 'fast-png'

async function test() {
  console.log('Fetching GDP_PPP -3000...')
  const gdpResp = await fetch('http://localhost:5174/api/raster/file?layer=GDP_PPP&year=-3000')
  const gdpBuf = Buffer.from(await gdpResp.arrayBuffer())
  const gdpPng = decodePng(gdpBuf)
  console.log('GDP PNG dimensions:', gdpPng.width, 'x', gdpPng.height, 'channels:', gdpPng.channels)

  console.log('Fetching population_total -3000...')
  const popResp = await fetch('http://localhost:5174/api/raster/file?layer=population_total&year=-3000')
  const popBuf = Buffer.from(await popResp.arrayBuffer())
  const popPng = decodePng(popBuf)
  console.log('POP PNG dimensions:', popPng.width, 'x', popPng.height, 'channels:', popPng.channels)

  // Compare sizes
  console.log('Total pixels:', gdpPng.width * gdpPng.height)
  // Let's decode pop data as int32 (4 bytes per pixel: RGBA)
  const popData = new Int32Array(popPng.data.buffer, popPng.data.byteOffset, popPng.width * popPng.height)
  let uninhabitedCount = 0
  let inhabitedCount = 0
  for (let i = 0; i < popData.length; i++) {
    if (popData[i] <= 0) {
      uninhabitedCount++
    } else {
      inhabitedCount++
    }
  }
  console.log(`Uninhabited cells (pop <= 0): ${uninhabitedCount} (${(uninhabitedCount / popData.length * 100).toFixed(1)}%)`)
  console.log(`Inhabited cells (pop > 0): ${inhabitedCount} (${(inhabitedCount / popData.length * 100).toFixed(1)}%)`)
}

test()
