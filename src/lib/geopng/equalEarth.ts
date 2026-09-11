// Equal Earth projection (Šavrič, Patterson, Jenny, 2018)
// An equal-area pseudocylindrical projection for world maps.

const A1 = 1.340264
const A2 = -0.081106
const A3 = 0.000893
const A4 = 0.003796
const M = Math.sqrt(3) / 2 // ~0.8660254037844386
const EPSILON = 1e-9
const ITERATIONS = 12

// Coordinate normalization factor to align with OrthographicView bounds [-180, 180]
// At equator (lat=0, lng=180 deg), x_raw = PI / (M * A1) ~ 2.70655
// Using SCALE = 180 / 2.70655436 gives x in [-180, 180]
export const EQUAL_EARTH_SCALE = 180 / (Math.PI / (M * A1)) // ~66.5052

/**
 * Raw Equal Earth forward projection: (lambda, phi) in radians -> [x, y] in raw projection units.
 */
export function equalEarthRaw(lambda: number, phi: number): [number, number] {
  // Clamp phi to valid latitude range [-PI/2, PI/2]
  const clampedPhi = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, phi))
  const sinPhi = Math.sin(clampedPhi)
  const l = Math.asin(Math.max(-1, Math.min(1, M * sinPhi)))
  const l2 = l * l
  const l6 = l2 * l2 * l2

  const denom = M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))
  const x = (lambda * Math.cos(l)) / denom
  const y = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2))

  return [x, y]
}

/**
 * Raw Equal Earth inverse projection: [x, y] in raw units -> [lambda, phi] in radians.
 */
export function equalEarthRawInvert(x: number, y: number): [number, number] {
  let l = y
  let l2 = l * l
  let l6 = l2 * l2 * l2

  for (let i = 0; i < ITERATIONS; i++) {
    const fy = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - y
    const fpy = A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)
    const delta = fy / fpy
    l -= delta
    l2 = l * l
    l6 = l2 * l2 * l2
    if (Math.abs(delta) < EPSILON) break
  }

  const denom = Math.cos(l)
  if (Math.abs(denom) < EPSILON) {
    return [0, Math.asin(Math.max(-1, Math.min(1, Math.sin(l) / M)))]
  }

  const lambda = (M * x * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))) / denom
  const phi = Math.asin(Math.max(-1, Math.min(1, Math.sin(l) / M)))

  return [lambda, phi]
}

/**
 * Project [lng, lat] (in degrees) to Equal Earth Cartesian coordinates [X, Y].
 */
export function projectEqualEarth(lng: number, lat: number): [number, number] {
  const lambda = (Math.max(-180, Math.min(180, lng)) * Math.PI) / 180
  const phi = (Math.max(-90, Math.min(90, lat)) * Math.PI) / 180
  const [rx, ry] = equalEarthRaw(lambda, phi)
  return [rx * EQUAL_EARTH_SCALE, ry * EQUAL_EARTH_SCALE]
}

/**
 * Invert Equal Earth Cartesian coordinates [X, Y] back to [lng, lat] in degrees.
 */
export function invertEqualEarth(x: number, y: number): [number, number] {
  const rx = x / EQUAL_EARTH_SCALE
  const ry = y / EQUAL_EARTH_SCALE
  const [lambda, phi] = equalEarthRawInvert(rx, ry)
  const lng = (lambda * 180) / Math.PI
  const lat = (phi * 180) / Math.PI
  return [Math.max(-180, Math.min(180, lng)), Math.max(-90, Math.min(90, lat))]
}

/**
 * Transforms a GeoJSON geometry's coordinates into Equal Earth projected coordinates.
 */
export function transformGeometryToEqualEarth(geometry: any): any {
  if (!geometry) return null
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((ring: number[][]) =>
        ring.map((pt) => projectEqualEarth(pt[0], pt[1]))
      ),
    }
  } else if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((poly: number[][][]) =>
        poly.map((ring) => ring.map((pt) => projectEqualEarth(pt[0], pt[1])))
      ),
    }
  } else if (geometry.type === 'LineString') {
    return {
      type: 'LineString',
      coordinates: geometry.coordinates.map((pt: number[]) => projectEqualEarth(pt[0], pt[1])),
    }
  } else if (geometry.type === 'MultiLineString') {
    return {
      type: 'MultiLineString',
      coordinates: geometry.coordinates.map((line: number[][]) =>
        line.map((pt) => projectEqualEarth(pt[0], pt[1]))
      ),
    }
  }
  return geometry
}

/**
 * Generates an Equal Earth graticule (parallels, meridians, and outer border).
 */
export function generateEqualEarthGraticule(
  latInterval: number = 10,
  lngInterval: number = 20
): { path: [number, number][] }[] {
  const paths: { path: [number, number][] }[] = []

  // Parallels (latitude lines)
  for (let lat = -80; lat <= 80; lat += latInterval) {
    const line: [number, number][] = []
    for (let lng = -180; lng <= 180; lng += 2) {
      line.push(projectEqualEarth(lng, lat))
    }
    paths.push({ path: line })
  }

  // Meridians (longitude lines)
  for (let lng = -180; lng <= 180; lng += lngInterval) {
    const line: [number, number][] = []
    for (let lat = -88; lat <= 88; lat += 2) {
      line.push(projectEqualEarth(lng, lat))
    }
    paths.push({ path: line })
  }

  // Outer boundary outline of the Equal Earth projection
  const border: [number, number][] = []
  // Top pole parallel
  for (let lng = -180; lng <= 180; lng += 2) {
    border.push(projectEqualEarth(lng, 90))
  }
  // Eastern meridian (+180)
  for (let lat = 90; lat >= -90; lat -= 2) {
    border.push(projectEqualEarth(180, lat))
  }
  // Bottom pole parallel
  for (let lng = 180; lng >= -180; lng -= 2) {
    border.push(projectEqualEarth(lng, -90))
  }
  // Western meridian (-180)
  for (let lat = -90; lat <= 90; lat += 2) {
    border.push(projectEqualEarth(-180, lat))
  }
  paths.push({ path: border })

  return paths
}
