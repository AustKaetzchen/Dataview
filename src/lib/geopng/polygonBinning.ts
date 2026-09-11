import { DecodedRaster } from './types'

export interface CountryProperties {
  name: string
  name_long?: string
  iso_a3?: string
  adm0_a3?: string
  sov_a3?: string
  continent?: string
  [key: string]: any
}

export interface CountryFeature {
  type: 'Feature'
  properties: CountryProperties
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: any
  }
  bbox?: [number, number, number, number]
}

export interface CountryStats {
  name: string
  isoA3: string
  totalCells: number
  validCount: number
  min: number
  max: number
  mean: number
  stdDev: number
  median: number
  quantiles: Record<number, number>
  histogram: {
    bins: number[]
    counts: number[]
    min: number
    max: number
  }
}

let cachedCountriesGeoJson: { type: string; features: CountryFeature[] } | null = null

/**
 * Loads and caches NaturalEarth countries GeoJSON.
 */
export async function loadCountriesGeoJson(): Promise<CountryFeature[]> {
  if (cachedCountriesGeoJson) {
    return cachedCountriesGeoJson.features
  }

  try {
    const res = await fetch('/data/ne_50m_admin_0_countries.geojson')
    if (!res.ok) throw new Error(`HTTP ${res.status} loading countries GeoJSON`)
    const data = await res.json()

    // Pre-calculate 2D bounding boxes and normalize properties for ultra-fast point/raster queries
    for (const feat of data.features) {
      feat.bbox = computeGeometryBBox(feat.geometry)
      const p = feat.properties
      p.name = p.name || p.NAME || p.ADMIN || p.NAME_LONG || p.name_long || 'Unknown'
      p.name_long = p.name_long || p.NAME_LONG || p.name
      const rawAdm = p.ADM0_A3 || p.adm0_a3 || ''
      const rawIso = p.ISO_A3 || p.iso_a3 || ''
      p.adm0_a3 = rawAdm || (rawIso && rawIso !== '-99' ? rawIso : '') || p.name
      p.iso_a3 = (rawIso && rawIso !== '-99') ? rawIso : p.adm0_a3
    }

    cachedCountriesGeoJson = data
    return data.features
  } catch (err) {
    console.error('Failed to load countries GeoJSON:', err)
    return []
  }
}

function computeGeometryBBox(geometry: any): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const processCoords = (coords: any) => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    } else {
      for (const c of coords) processCoords(c)
    }
  }
  processCoords(geometry.coordinates)
  return [minX, minY, maxX, maxY]
}

/**
 * Checks if a point [lng, lat] is inside a polygon ring using ray casting.
 */
export function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Tests whether a point [lng, lat] is inside a GeoJSON geometry (Polygon or MultiPolygon with holes).
 */
export function isPointInGeometry(lng: number, lat: number, geometry: any): boolean {
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as number[][][]
    if (!pointInRing(lng, lat, rings[0])) return false
    for (let i = 1; i < rings.length; i++) {
      if (pointInRing(lng, lat, rings[i])) return false // In hole
    }
    return true
  } else if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates as number[][][][]
    for (const poly of polygons) {
      if (pointInRing(lng, lat, poly[0])) {
        let inHole = false
        for (let i = 1; i < poly.length; i++) {
          if (pointInRing(lng, lat, poly[i])) {
            inHole = true
            break
          }
        }
        if (!inHole) return true
      }
    }
    return false
  }
  return false
}

/**
 * Finds the country feature containing [lng, lat].
 */
export function findCountryAtLngLat(lng: number, lat: number, features: CountryFeature[]): CountryFeature | null {
  for (const feat of features) {
    if (feat.bbox) {
      const [minX, minY, maxX, maxY] = feat.bbox
      if (lng < minX || lng > maxX || lat < minY || lat > maxY) {
        continue
      }
    }
    if (isPointInGeometry(lng, lat, feat.geometry)) {
      return feat
    }
  }
  return null
}

/**
 * High-performance scanline polygon binning of a GeoPNG raster.
 * Extracts all raster cells falling within the polygon boundaries and computes
 * summary statistics, quantiles, and histogram.
 */
export function binRasterByCountry(
  raster: DecodedRaster,
  feature: CountryFeature
): CountryStats {
  const name = feature.properties.name || feature.properties.name_long || 'Unknown'
  const isoA3 = feature.properties.iso_a3 || feature.properties.adm0_a3 || feature.properties.sov_a3 || ''

  const geometry = feature.geometry
  const polygons: number[][][][] =
    geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][])

  const W = raster.width
  const H = raster.height

  let min = Infinity
  let max = -Infinity
  let sum = 0
  let validCount = 0
  let totalCells = 0

  // We collect samples for quantile and histogram computation
  const values: number[] = []

  for (const poly of polygons) {
    const exteriorRing = poly[0]
    const holeRings = poly.slice(1)

    // Calculate bbox for this specific polygon part
    let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity
    for (const pt of exteriorRing) {
      if (pt[0] < pMinX) pMinX = pt[0]
      if (pt[1] < pMinY) pMinY = pt[1]
      if (pt[0] > pMaxX) pMaxX = pt[0]
      if (pt[1] > pMaxY) pMaxY = pt[1]
    }

    const minRow = Math.max(0, Math.floor(((90 - pMaxY) / 180) * H))
    const maxRow = Math.min(H - 1, Math.ceil(((90 - pMinY) / 180) * H))
    const minCol = Math.max(0, Math.floor(((pMinX + 180) / 360) * W))
    const maxCol = Math.min(W - 1, Math.ceil(((pMaxX + 180) / 360) * W))

    // Scanline rasterization for each row
    for (let r = minRow; r <= maxRow; r++) {
      const lat = 90 - ((r + 0.5) / H) * 180

      // Find all intersections with exterior ring segments
      const intersections: number[] = []
      for (let i = 0, j = exteriorRing.length - 1; i < exteriorRing.length; j = i++) {
        const p1 = exteriorRing[i]
        const p2 = exteriorRing[j]
        if ((p1[1] <= lat && p2[1] > lat) || (p2[1] <= lat && p1[1] > lat)) {
          const t = (lat - p1[1]) / (p2[1] - p1[1])
          const lng = p1[0] + t * (p2[0] - p1[0])
          intersections.push(lng)
        }
      }

      if (intersections.length < 2) continue
      intersections.sort((a, b) => a - b)

      // Traverse pairs of intersections
      for (let k = 0; k < intersections.length - 1; k += 2) {
        const xStart = intersections[k]
        const xEnd = intersections[k + 1]

        const cStart = Math.max(minCol, Math.floor(((xStart + 180) / 360) * W))
        const cEnd = Math.min(maxCol, Math.ceil(((xEnd + 180) / 360) * W))

        const rowOffset = r * W

        for (let c = cStart; c <= cEnd; c++) {
          const lng = -180 + ((c + 0.5) / W) * 360

          // Check holes if any
          let inHole = false
          for (const hole of holeRings) {
            if (pointInRing(lng, lat, hole)) {
              inHole = true
              break
            }
          }
          if (inHole) continue

          totalCells++
          const val = raster.data[rowOffset + c]
          if (!Number.isNaN(val) && Number.isFinite(val)) {
            if (val < min) min = val
            if (val > max) max = val
            sum += val
            validCount++
            values.push(val)
          }
        }
      }
    }
  }

  const mean = validCount > 0 ? sum / validCount : 0

  // Variance & standard deviation
  let varianceSum = 0
  if (validCount > 1) {
    for (let i = 0; i < values.length; i++) {
      varianceSum += (values[i] - mean) ** 2
    }
  }
  const stdDev = validCount > 1 ? Math.sqrt(varianceSum / (validCount - 1)) : 0

  // Subsample values if excessively large (e.g. > 50,000) for fast quantile calculation
  let sampleValues = values
  if (values.length > 50000) {
    const step = Math.ceil(values.length / 50000)
    sampleValues = []
    for (let i = 0; i < values.length; i += step) {
      sampleValues.push(values[i])
    }
  }
  sampleValues.sort((a, b) => a - b)

  const quantiles: Record<number, number> = {}
  let median = 0
  if (sampleValues.length > 0) {
    const pKeys = [0, 5, 10, 25, 50, 75, 90, 95, 100]
    for (const p of pKeys) {
      const idx = Math.min(
        sampleValues.length - 1,
        Math.max(0, Math.floor((p / 100) * (sampleValues.length - 1)))
      )
      quantiles[p] = sampleValues[idx]
    }
    median = quantiles[50] ?? 0
  }

  const safeMin = Number.isFinite(min) ? min : 0
  const safeMax = Number.isFinite(max) ? max : 1

  // 60-bin histogram
  const binCount = 60
  const binEdges: number[] = []
  const binCounts: number[] = new Array(binCount).fill(0)
  const binWidth = (safeMax - safeMin) / binCount || 1

  for (let b = 0; b <= binCount; b++) {
    binEdges.push(safeMin + b * binWidth)
  }

  for (let i = 0; i < sampleValues.length; i++) {
    const v = sampleValues[i]
    let bIdx = Math.floor((v - safeMin) / binWidth)
    if (bIdx < 0) bIdx = 0
    if (bIdx >= binCount) bIdx = binCount - 1
    binCounts[bIdx]++
  }

  return {
    name,
    isoA3,
    totalCells,
    validCount,
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    mean,
    stdDev,
    median,
    quantiles,
    histogram: {
      bins: binEdges,
      counts: binCounts,
      min: safeMin,
      max: safeMax,
    },
  }
}

// Global memoization cache for ultra-fast country stats retrieval during hover
const statsCache = new Map<string, CountryStats>()
let lastCachedRaster: DecodedRaster | null = null

export function binRasterByCountryMemoized(
  raster: DecodedRaster,
  feature: CountryFeature
): CountryStats {
  if (lastCachedRaster !== raster) {
    statsCache.clear()
    lastCachedRaster = raster
  }
  const key = feature.properties.adm0_a3 || feature.properties.iso_a3 || feature.properties.name
  const cached = statsCache.get(key)
  if (cached) return cached

  const result = binRasterByCountry(raster, feature)
  statsCache.set(key, result)
  return result
}
