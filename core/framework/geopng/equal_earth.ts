//Equal Earth projection (Šavrič, Patterson, Jenny, 2018)
//An equal-area pseudocylindrical projection for world maps.

let A1 = 1.340264
let A2 = -0.081106
let A3 = 0.000893
let A4 = 0.003796
let M = Math.sqrt(3)/2 //~0.8660254037844386
let EPSILON = 1e-9
let ITERATIONS = 12

//Coordinate normalisation factor to align with OrthographicView bounds [-180, 180]
export let EQUAL_EARTH_SCALE = 180/(Math.PI/(M*A1)) //~66.5052

/**
 * Raw Equal Earth forward projection: (lambda, phi) in radians -> [x, y] in raw projection units.
 *
 * @param {number} arg0_lambda
 * @param {number} arg1_phi
 *
 * @returns {[number, number]}
 */
export function equalEarthRaw (arg0_lambda: number, arg1_phi: number): [number, number] {
  //Convert from parameters
  let lambda = arg0_lambda
  let phi = arg1_phi

  //Declare local instance variables
  let clamped_phi = Math.max(-Math.PI/2, Math.min(Math.PI/2, phi))
  let denom: number
  let l: number
  let l2: number
  let l6: number
  let sin_phi = Math.sin(clamped_phi)
  let x: number
  let y: number

  //Function body
  l = Math.asin(Math.max(-1, Math.min(1, M*sin_phi)))
  l2 = l*l
  l6 = l2*l2*l2

  denom = M*(A1 + 3*A2*l2 + l6*(7*A3 + 9*A4*l2))
  x = (lambda*Math.cos(l))/denom
  y = l*(A1 + A2*l2 + l6*(A3 + A4*l2))

  //Return statement
  return [x, y]
}

/**
 * Raw Equal Earth inverse projection: [x, y] in raw units -> [lambda, phi] in radians.
 *
 * @param {number} arg0_x
 * @param {number} arg1_y
 *
 * @returns {[number, number]}
 */
export function equalEarthRawInvert (arg0_x: number, arg1_y: number): [number, number] {
  //Convert from parameters
  let x = arg0_x
  let y = arg1_y

  //Declare local instance variables
  let denom: number
  let l = y
  let l2 = l*l
  let l6 = l2*l2*l2
  let lambda: number
  let phi: number

  //Function body
  for (let i = 0; i < ITERATIONS; i++) {
    let fy = l*(A1 + A2*l2 + l6*(A3 + A4*l2)) - y
    let fpy = A1 + 3*A2*l2 + l6*(7*A3 + 9*A4*l2)
    let delta = fy/fpy
    l -= delta
    l2 = l*l
    l6 = l2*l2*l2
    if (Math.abs(delta) < EPSILON)
      break
  }

  denom = Math.cos(l)
  if (Math.abs(denom) < EPSILON)
    return [0, Math.asin(Math.max(-1, Math.min(1, Math.sin(l)/M)))]

  lambda = (M*x*(A1 + 3*A2*l2 + l6*(7*A3 + 9*A4*l2)))/denom
  phi = Math.asin(Math.max(-1, Math.min(1, Math.sin(l)/M)))

  //Return statement
  return [lambda, phi]
}

/**
 * Generates an Equal Earth graticule (parallels, meridians, and outer border).
 *
 * @param {number} [arg0_lat_interval=10]
 * @param {number} [arg1_lng_interval=20]
 *
 * @returns {{ path: [number, number][] }[]}
 */
export function generateEqualEarthGraticule (
  arg0_lat_interval?: number,
  arg1_lng_interval?: number
): { path: [number, number][] }[] {
  //Convert from parameters
  let lat_interval = (arg0_lat_interval !== undefined) ? arg0_lat_interval : 10
  let lng_interval = (arg1_lng_interval !== undefined) ? arg1_lng_interval : 20

  //Declare local instance variables
  let border: [number, number][] = []
  let paths: { path: [number, number][] }[] = []

  //Function body
  //Parallels (latitude lines)
  for (let lat = -80; lat <= 80; lat += lat_interval) {
    let line: [number, number][] = []
    for (let lng = -180; lng <= 180; lng += 2)
      line.push(projectEqualEarth(lng, lat))
    paths.push({ path: line })
  }

  //Meridians (longitude lines)
  for (let lng = -180; lng <= 180; lng += lng_interval) {
    let line: [number, number][] = []
    for (let lat = -88; lat <= 88; lat += 2)
      line.push(projectEqualEarth(lng, lat))
    paths.push({ path: line })
  }

  //Outer boundary outline of the Equal Earth projection
  for (let lng = -180; lng <= 180; lng += 2)
    border.push(projectEqualEarth(lng, 90))
  for (let lat = 90; lat >= -90; lat -= 2)
    border.push(projectEqualEarth(180, lat))
  for (let lng = 180; lng >= -180; lng -= 2)
    border.push(projectEqualEarth(lng, -90))
  for (let lat = -90; lat <= 90; lat += 2)
    border.push(projectEqualEarth(-180, lat))
  paths.push({ path: border })

  //Return statement
  return paths
}

/**
 * Invert Equal Earth Cartesian coordinates [X, Y] back to [lng, lat] in degrees.
 *
 * @param {number} arg0_x
 * @param {number} arg1_y
 *
 * @returns {[number, number]}
 */
export function invertEqualEarth (arg0_x: number, arg1_y: number): [number, number] {
  //Convert from parameters
  let x = arg0_x
  let y = arg1_y

  //Declare local instance variables
  let lat: number
  let lng: number
  let rx = x/EQUAL_EARTH_SCALE
  let ry = y/EQUAL_EARTH_SCALE

  //Function body
  let [lambda, phi] = equalEarthRawInvert(rx, ry)
  lng = (lambda*180)/Math.PI
  lat = (phi*180)/Math.PI

  //Return statement
  return [Math.max(-180, Math.min(180, lng)), Math.max(-90, Math.min(90, lat))]
}

/**
 * Project [lng, lat] (in degrees) to Equal Earth Cartesian coordinates [X, Y].
 *
 * @param {number} arg0_lng
 * @param {number} arg1_lat
 *
 * @returns {[number, number]}
 */
export function projectEqualEarth (arg0_lng: number, arg1_lat: number): [number, number] {
  //Convert from parameters
  let lat = arg1_lat
  let lng = arg0_lng

  //Declare local instance variables
  let lambda = (Math.max(-180, Math.min(180, lng))*Math.PI)/180
  let phi = (Math.max(-90, Math.min(90, lat))*Math.PI)/180

  //Function body
  let [rx, ry] = equalEarthRaw(lambda, phi)

  //Return statement
  return [rx*EQUAL_EARTH_SCALE, ry*EQUAL_EARTH_SCALE]
}

/**
 * Transforms a GeoJSON geometry's coordinates into Equal Earth projected coordinates.
 *
 * @param {any} arg0_geometry
 *
 * @returns {any}
 */
export function transformGeometryToEqualEarth (arg0_geometry: any): any {
  //Convert from parameters
  let geometry = arg0_geometry

  //Guard clauses
  if (!geometry)
    return null

  //Return statement
  if (geometry.type === 'Polygon') {
    return {
      coordinates: geometry.coordinates.map((arg0_ring: number[][]) =>
        arg0_ring.map((arg0_pt) => projectEqualEarth(arg0_pt[0], arg0_pt[1]))
      ),
      type: 'Polygon',
    }
  } else if (geometry.type === 'MultiPolygon') {
    return {
      coordinates: geometry.coordinates.map((arg0_poly: number[][][]) =>
        arg0_poly.map((arg0_ring) => arg0_ring.map((arg0_pt) => projectEqualEarth(arg0_pt[0], arg0_pt[1])))
      ),
      type: 'MultiPolygon',
    }
  } else if (geometry.type === 'LineString') {
    return {
      coordinates: geometry.coordinates.map((arg0_pt: number[]) => projectEqualEarth(arg0_pt[0], arg0_pt[1])),
      type: 'LineString',
    }
  } else if (geometry.type === 'MultiLineString') {
    return {
      coordinates: geometry.coordinates.map((arg0_line: number[][]) =>
        arg0_line.map((arg0_pt) => projectEqualEarth(arg0_pt[0], arg0_pt[1]))
      ),
      type: 'MultiLineString',
    }
  }

  return geometry
}
