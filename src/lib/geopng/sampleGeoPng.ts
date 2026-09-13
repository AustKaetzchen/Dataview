import { encode as encodePng } from 'fast-png'

/**
 * Generates a synthetic global GeoPNG raster for demo and automated testing.
 *
 * @param {number} [arg0_width=1440]
 * @param {number} [arg1_height=720]
 *
 * @returns {Uint8Array}
 */
export function generateSampleGeoPngBuffer (arg0_width?: number, arg1_height?: number): Uint8Array {
  //Convert from parameters
  let height = (arg1_height !== undefined) ? arg1_height : 720
  let width = (arg0_width !== undefined) ? arg0_width : 1440

  //Declare local instance variables
  let rgba = new Uint8Array(width*height*4)
  let view = new DataView(new ArrayBuffer(4))

  //Function body
  for (let i = 0; i < height; i++) {
    let lat = 90 - (i/(height - 1))*180
    let lat_rad = (lat*Math.PI)/180

    for (let x = 0; x < width; x++) {
      let lon = -180 + (x/(width - 1))*360
      let lon_rad = (lon*Math.PI)/180

      //Synthetic global harmonic surface
      let val =
        Math.cos(lat_rad)*28 +
        Math.sin(lon_rad*3)*Math.cos(lat_rad*2)*14 +
        Math.sin(lat_rad*4 + lon_rad*2)*6

      view.setFloat32(0, val, false) //Big-endian float32

      let idx = (i*width + x)*4
      rgba[idx + 0] = view.getUint8(0)
      rgba[idx + 1] = view.getUint8(1)
      rgba[idx + 2] = view.getUint8(2)
      rgba[idx + 3] = view.getUint8(3)
    }
  }

  //Return statement
  return encodePng({
    channels: 4,
    data: rgba,
    depth: 8,
    height,
    width,
  })
}
