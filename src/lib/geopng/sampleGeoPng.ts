import { encode as encodePng } from 'fast-png'

/**
 * Generates a synthetic global GeoPNG raster for demo and automated testing
 * with realistic global harmonic climate/elevation patterns encoded as float32 in RGBA.
 */
export function generateSampleGeoPngBuffer(width = 1440, height = 720): Uint8Array {
  const rgba = new Uint8Array(width * height * 4)
  const view = new DataView(new ArrayBuffer(4))

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / (height - 1)) * 180
    const latRad = (lat * Math.PI) / 180
    for (let x = 0; x < width; x++) {
      const lon = -180 + (x / (width - 1)) * 360
      const lonRad = (lon * Math.PI) / 180

      // Synthetic global harmonic surface (e.g. global surface temperature / elevation)
      const val =
        Math.cos(latRad) * 28 +
        Math.sin(lonRad * 3) * Math.cos(latRad * 2) * 14 +
        Math.sin(latRad * 4 + lonRad * 2) * 6

      view.setFloat32(0, val, false) // Big-endian float32

      const idx = (y * width + x) * 4
      rgba[idx + 0] = view.getUint8(0)
      rgba[idx + 1] = view.getUint8(1)
      rgba[idx + 2] = view.getUint8(2)
      rgba[idx + 3] = view.getUint8(3)
    }
  }

  return encodePng({
    width,
    height,
    data: rgba,
    channels: 4,
    depth: 8,
  })
}
