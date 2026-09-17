import fs from 'fs'
import path from 'path'
import {
  downsampleRasterSum,
  getRasterDimensions,
  isFileCacheStale,
  loadGeoPngAsFloat32,
  readFloat32FromBmp,
} from '../core/server/raster_bmp_cache.ts'
import { getOptimisationConfig } from '../common/optimisation/optimisation.ts'

console.log('[Test] 1. Checking optimisation config...')
let opt = getOptimisationConfig()
console.log(`[Test] Configured resolution: [${opt.width}, ${opt.height}], mtime: ${opt.mtimeMs}`)

if (opt.width !== 1920 || opt.height !== 1080) {
  console.error('[Test] FAILED: Resolution is not [1920, 1080]')
  process.exit(1)
}

console.log('[Test] 2. Testing downsampleRasterSum exact sum conservation...')
let src_w = 4320
let src_h = 2160
let dst_w = 1920
let dst_h = 1080
let src_data = new Float32Array(src_w * src_h)

// Fill with sample values
let expected_sum = 0
for (let i = 0; i < src_data.length; i += 17) {
  let val = (i % 1000) * 1.5
  src_data[i] = val
  expected_sum += val
}

let downsampled = downsampleRasterSum(src_data, src_w, src_h, dst_w, dst_h)
if (downsampled.length !== dst_w * dst_h) {
  console.error(`[Test] FAILED: Output length ${downsampled.length} !== ${dst_w * dst_h}`)
  process.exit(1)
}

let actual_sum = 0
for (let i = 0; i < downsampled.length; i++) {
  actual_sum += downsampled[i]
}

let diff = Math.abs(actual_sum - expected_sum)
let relative_err = diff / expected_sum
console.log(`[Test] Expected sum: ${expected_sum.toFixed(4)}, Actual sum: ${actual_sum.toFixed(4)}, Relative error: ${relative_err.toExponential(4)}`)

if (relative_err > 1e-5) {
  console.error('[Test] FAILED: Sum was not conserved during downsampling!')
  process.exit(1)
}
console.log('[Test] PASSED: Sum aggregation strictly preserves global counts!')

console.log('[Test] 3. Testing real GeoPNG loading, caching & dimension validation...')
let sample_png = 'D:/Project 1509 - SVEA/histmap/3.data_transform/age_sex/4.composite_cohorts/f_00_1950.png'
if (fs.existsSync(sample_png)) {
  let sample_bmp = path.resolve(process.cwd(), 'data/raster_cache/f_00_1950.bmp')
  
  // Verify stale check
  let is_stale_before = isFileCacheStale(sample_png, sample_bmp)
  console.log(`[Test] Stale check on f_00_1950.bmp (before recache): is_stale = ${is_stale_before}`)

  let f32 = loadGeoPngAsFloat32(sample_png)
  if (!f32) {
    console.error('[Test] FAILED: Failed to load and cache GeoPNG')
    process.exit(1)
  }
  console.log(`[Test] Loaded Float32Array with length ${f32.length} (expected ${dst_w * dst_h})`)
  if (f32.length !== dst_w * dst_h) {
    console.error(`[Test] FAILED: Decoded length is not ${dst_w * dst_h}`)
    process.exit(1)
  }

  let bmp_stat = fs.statSync(sample_bmp)
  let expected_bytes = 64 + dst_w * dst_h * 4
  console.log(`[Test] Cache file size on disk: ${bmp_stat.size} bytes (expected ${expected_bytes} bytes = ~8.29 MB)`)
  if (bmp_stat.size !== expected_bytes) {
    console.error(`[Test] FAILED: Cache file size ${bmp_stat.size} !== ${expected_bytes}`)
    process.exit(1)
  }

  let is_stale_after = isFileCacheStale(sample_png, sample_bmp)
  console.log(`[Test] Stale check on f_00_1950.bmp (after recache): is_stale = ${is_stale_after} (expected false)`)
  if (is_stale_after !== false) {
    console.error('[Test] FAILED: Fresh cache is reported as stale')
    process.exit(1)
  }

  console.log('[Test] PASSED: Real raster downsampled, cached at 1920x1080 and validated!')
} else {
  console.log('[Test] SKIPPED real file test: source file not found at path')
}

console.log('[Test] ALL TESTS COMPLETED SUCCESSFULLY!')
