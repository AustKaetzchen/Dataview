import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import ffmpegPath from 'ffmpeg-static'
import { ParsedDataLayer, generateSelectorCombinations } from './layerParser.ts'

export interface CyclingRenderItem {
  displayName: string
  folderName: string
  layerId: string
  selectors?: Record<string, string>
}

export interface TimelapseJobStatus {
  currentFrame: number
  error?: string
  filename: string
  jobId: string
  message: string
  path?: string
  progressPct: number
  sizeBytes?: number
  status: 'idle' | 'rendering' | 'encoding' | 'complete' | 'cancelled' | 'error'
  totalFrames: number
}

export interface TimelapseRenderOptions {
  concurrency?: number
  cyclingTargets?: CyclingRenderItem[]
  endYear: number
  fps?: number
  height?: number
  keepFrames?: boolean
  keyframesOnly?: boolean
  legendPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  maxRamPerThreadMb?: number
  mode: 'sequential' | 'cycling' | 'stationary'
  outputFilename?: string
  projection?: string
  resumeFolder?: string
  selectedLayers?: string[]
  startYear: number
  timestepStep?: number
  variableSelectors?: Record<string, string | string[]>
  width?: number
  zoom?: number
}

let active_jobs = new Map<string, TimelapseJobStatus>()
let active_browser_pools = new Map<string, Browser[]>()
let cancellation_tokens = new Set<string>()

/**
 * Finds the local Google Chrome or Microsoft Edge executable path on Windows.
 *
 * @returns {string}
 */
export const findBrowserExecutable = function () {
  //Declare local instance variables
  let candidate_paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.CHROME_PATH || '',
  ]
  let chosen_path = ''

  //Function body
  for (let i = 0; i < candidate_paths.length; i++) {
    let p = candidate_paths[i]
    if (p && fs.existsSync(p)) {
      chosen_path = p
      break
    }
  }

  if (!chosen_path)
    throw new Error('No compatible Chrome or Edge executable found on server.')

  //Return statement
  return chosen_path
}

/**
 * Retrieves the status of an in-progress or completed timelapse job.
 *
 * @param {string} arg0_job_id
 *
 * @returns {TimelapseJobStatus | null}
 */
export const getTimelapseJobStatus = function (arg0_job_id: string) {
  //Convert from parameters
  let job_id = arg0_job_id

  //Return statement
  return active_jobs.get(job_id) || null
}

/**
 * Cancels an active timelapse rendering job.
 *
 * @param {string} arg0_job_id
 *
 * @returns {boolean}
 */
export const cancelTimelapseJob = function (arg0_job_id: string) {
  //Convert from parameters
  let job_id = arg0_job_id

  //Function body
  cancellation_tokens.add(job_id)
  let job = active_jobs.get(job_id)
  if (job) {
    job.status = 'cancelled'
    job.message = 'Timelapse rendering cancelled by user.'
  }

  let pool = active_browser_pools.get(job_id)
  if (pool) {
    for (let i = 0; i < pool.length; i++) {
      pool[i].close().catch(() => {})
    }
    active_browser_pools.delete(job_id)
  }

  //Return statement
  return true
}

/**
 * Expands a list of layer keys or targets into concrete individual cohort rendering items.
 *
 * @param {string[]} arg0_layer_keys
 * @param {Record<string, ParsedDataLayer>} [arg1_registry_layers]
 *
 * @returns {CyclingRenderItem[]}
 */
export const expandLayersToCyclingTargets = function (
  arg0_layer_keys: string[],
  arg1_registry_layers?: Record<string, ParsedDataLayer>
): CyclingRenderItem[] {
  //Convert from parameters
  let layer_keys = arg0_layer_keys
  let registry_layers = (arg1_registry_layers) ? arg1_registry_layers : {}

  //Declare local instance variables
  let expanded: CyclingRenderItem[] = []

  //Guard clauses
  if (!layer_keys || layer_keys.length === 0)
    return [{ displayName: 'GDP per capita (Nominal)', folderName: 'GDP per capita (Nominal)', layerId: 'GDP_nominal_pc', selectors: {} }]

  //Function body
  for (let i = 0; i < layer_keys.length; i++) {
    let raw_key = layer_keys[i]

    //Check if key is already an encoded cohort: e.g. "layer_id::sel1=val1&sel2=val2"
    if (raw_key.includes('::')) {
      let parts = raw_key.split('::')
      let layer_id = parts[0]
      let params = new URLSearchParams(parts[1] || '')
      let selectors: Record<string, string> = {}
      params.forEach((arg0_val, arg0_k) => {
        selectors[arg0_k] = arg0_val
      })
      let layer_obj = registry_layers[layer_id]
      let name_parts: string[] = []
      if (layer_obj?.variable_selectors) {
        let sk_keys = Object.keys(selectors)
        for (let x = 0; x < sk_keys.length; x++) {
          let sk = sk_keys[x]
          let opt_name = layer_obj.variable_selectors[sk]?.options[selectors[sk]]?.name || selectors[sk]
          if (opt_name !== 'Total')
            name_parts.push(opt_name)
        }
      }
      let sub_name = name_parts.length > 0 ? name_parts.join(', ') : raw_key
      let display_title = layer_obj ? `${layer_obj.name} (${sub_name})` : sub_name
      expanded.push({
        displayName: display_title,
        folderName: layer_obj?.name || layer_id,
        layerId: layer_id,
        selectors,
      })
      continue
    }

    let layer = registry_layers[raw_key]

    //1. Sub-layers (e.g. labourforce_total -> female, male)
    if (layer && layer.sub_layers && layer.sub_layers.length > 0) {
      for (let x = 0; x < layer.sub_layers.length; x++) {
        let sub = layer.sub_layers[x]
        expanded.push({
          displayName: sub.name,
          folderName: layer.name,
          layerId: sub.id,
          selectors: {},
        })
      }
      continue
    }

    //2. Professions (%) or Professions (Total)
    if (raw_key === 'professions_percentage' || raw_key === 'professions_total') {
      let title_prefix = raw_key === 'professions_percentage' ? 'Professions (%)' : 'Professions (Total)'
      let professions = [
        { id: 'agriculture', name: 'Agriculture' },
        { id: 'informal_labour', name: 'Informal Labour' },
        { id: 'manufacturing', name: 'Manufacturing' },
        { id: 'services', name: 'Services' },
        { id: 'not_in_work', name: 'Not in Work' },
      ]
      for (let x = 0; x < professions.length; x++) {
        let p = professions[x]
        expanded.push({
          displayName: `${title_prefix} - ${p.name}`,
          folderName: title_prefix,
          layerId: raw_key,
          selectors: { gender: 't', profession: p.id },
        })
      }
      continue
    }

    //3. Age/Sex (Total)
    if (raw_key === 'age_sex') {
      let age_brackets = [
        { id: '00', name: '0-1yo, Infants' },
        { id: '01', name: '1-5yo' },
        { id: '05', name: '5-10yo' },
        { id: '10', name: '10-15yo' },
        { id: '15', name: '15-20yo' },
        { id: '20', name: '20-25yo' },
        { id: '25', name: '25-30yo' },
        { id: '30', name: '30-35yo' },
        { id: '35', name: '35-40yo' },
        { id: '40', name: '40-45yo' },
        { id: '45', name: '45-50yo' },
        { id: '50', name: '50-55yo' },
        { id: '55', name: '55-60yo' },
        { id: '60', name: '60-65yo' },
        { id: '65', name: '65-70yo' },
        { id: '70', name: '70-75yo' },
        { id: '75', name: '75-80yo' },
        { id: '80', name: '80+yo' },
      ]
      //Female cohorts
      for (let x = 0; x < age_brackets.length; x++) {
        let a = age_brackets[x]
        expanded.push({
          displayName: `Age/Sex - Female (${a.name})`,
          folderName: 'Age/Sex (Total)',
          layerId: 'age_sex',
          selectors: { age: a.id, gender: 'f' },
        })
      }
      //Male cohorts
      for (let x = 0; x < age_brackets.length; x++) {
        let a = age_brackets[x]
        expanded.push({
          displayName: `Age/Sex - Male (${a.name})`,
          folderName: 'Age/Sex (Total)',
          layerId: 'age_sex',
          selectors: { age: a.id, gender: 'm' },
        })
      }
      continue
    }

    //4. Wealth/Income
    if (raw_key === 'wealth_income') {
      let indicators = [
        { id: 'net_wealth', name: 'Net Wealth' },
        { id: 'net_income', name: 'Net Income' },
        { id: 'disposable_income', name: 'Disposable Income' },
        { id: 'discretionary_income', name: 'Discretionary Income' },
      ]
      for (let x = 0; x < indicators.length; x++) {
        let ind = indicators[x]
        expanded.push({
          displayName: `Wealth/Income - ${ind.name}`,
          folderName: 'Wealth/Income',
          layerId: 'wealth_income',
          selectors: { indicator: ind.id },
        })
      }
      continue
    }

    //5. Deaths
    if (raw_key === 'deaths') {
      expanded.push({
        displayName: 'Deaths - Female',
        folderName: 'Deaths',
        layerId: 'deaths',
        selectors: { gender: 'female' },
      })
      expanded.push({
        displayName: 'Deaths - Male',
        folderName: 'Deaths',
        layerId: 'deaths',
        selectors: { gender: 'male' },
      })
      continue
    }

    //6. Migration (Gender)
    if (raw_key === 'migration_gender') {
      expanded.push({
        displayName: 'Migration (Gender) - Female',
        folderName: 'Migration (Gender)',
        layerId: 'migration_gender',
        selectors: { gender: 'female' },
      })
      expanded.push({
        displayName: 'Migration (Gender) - Male',
        folderName: 'Migration (Gender)',
        layerId: 'migration_gender',
        selectors: { gender: 'male' },
      })
      continue
    }

    //7. Generic layer with variable selectors
    if (layer && layer.variable_selectors && Object.keys(layer.variable_selectors).length > 0) {
      let combos = generateSelectorCombinations(layer.variable_selectors)
      for (let x = 0; x < combos.length; x++) {
        let c = combos[x]
        let labels = Object.entries(c).map(([k, v]) => layer.variable_selectors![k]?.options[v]?.name || v).filter(n => n !== 'Total')
        let label_str = labels.length > 0 ? labels.join(', ') : 'Default'
        expanded.push({
          displayName: `${layer.name} - ${label_str}`,
          folderName: layer.name,
          layerId: raw_key,
          selectors: c,
        })
      }
      continue
    }

    //8. Standalone layer
    expanded.push({
      displayName: layer?.name || raw_key,
      folderName: layer?.name || raw_key,
      layerId: raw_key,
      selectors: {},
    })
  }

  //Return statement
  return expanded
}

/**
 * Starts a server-side timelapse rendering job using parallel headless Chrome instances and ffmpeg-static.
 *
 * @param {TimelapseRenderOptions} arg0_options
 * @param {string} arg0_exports_dir
 * @param {string} [arg0_client_url='http://localhost:5174']
 * @param {Record<string, ParsedDataLayer>} [arg0_registry_layers]
 *
 * @returns {Promise<TimelapseJobStatus>}
 */
export const startTimelapseRenderJob = async function (
  arg0_options: TimelapseRenderOptions,
  arg0_exports_dir: string,
  arg0_client_url?: string,
  arg0_registry_layers?: Record<string, ParsedDataLayer>
) {
  //Convert from parameters
  let client_url = arg0_client_url || 'http://localhost:5174'
  let exports_dir = path.resolve(arg0_exports_dir)
  let options = arg0_options
  let registry_layers = (arg0_registry_layers) ? arg0_registry_layers : {}

  //Declare local instance variables
  let active_browsers: Browser[] = []
  let base_name: string
  let clean_filename: string
  let completed_frames = 0
  let concurrency = options.concurrency ? Math.max(1, Math.min(16, options.concurrency)) : 4
  let effective_mode: 'sequential' | 'cycling' = options.mode === 'cycling' ? 'cycling' : 'sequential'
  let end_year = options.endYear
  let executable_path: string
  let export_h = options.height || 1080
  let export_w = options.width || 1920
  let export_zoom: number
  let ffmpeg_bin: string
  let fps = options.fps || 30
  let frames_dir: string
  let frames_folder_name: string
  let job_id = `timelapse_${Date.now()}`
  let job_status: TimelapseJobStatus
  let keep_frames = Boolean(options.keepFrames)
  let keyframes_only = options.keyframesOnly !== false
  let launch_args: string[]
  let legend_position = options.legendPosition || 'top-left'
  let manifest_path: string
  let max_ram_mb = options.maxRamPerThreadMb && options.maxRamPerThreadMb > 0 ? options.maxRamPerThreadMb : 0
  let output_mp4_path: string
  let projection = options.projection || 'EqualEarth'
  let render_targets: CyclingRenderItem[] = []
  let start_year = options.startYear
  let stitched_dir: string
  let target_queue: number[] = []
  let target_years: number[][] = []
  let total_steps = 0
  let worker_promises: Promise<void>[] = []
  let years_list: number[] = []

  //Function body
  //Initialise exports directory
  if (!fs.existsSync(exports_dir))
    fs.mkdirSync(exports_dir, { recursive: true })

  //Ensure even dimensions for H.264 compatibility
  export_w = export_w % 2 === 0 ? export_w : export_w + 1
  export_h = export_h % 2 === 0 ? export_h : export_h + 1

  base_name = (options.outputFilename || `dataview_timelapse_${Date.now()}`).replace(/\.(mp4|webm)$/i, '')
  clean_filename = `${base_name}.mp4`
  output_mp4_path = path.join(exports_dir, clean_filename)

  frames_folder_name = options.resumeFolder || base_name
  frames_dir = path.join(exports_dir, 'frames', frames_folder_name)
  stitched_dir = path.join(frames_dir, 'stitched')

  if (options.cyclingTargets && options.cyclingTargets.length > 0) {
    render_targets = options.cyclingTargets
  } else if (options.selectedLayers && options.selectedLayers.length > 0) {
    render_targets = expandLayersToCyclingTargets(options.selectedLayers, registry_layers)
  } else {
    render_targets = [{ displayName: 'GDP per capita (Nominal)', folderName: 'GDP per capita (Nominal)', layerId: 'GDP_nominal_pc', selectors: {} }]
  }

  //Calculate sequence of years per target based on mode
  if (effective_mode === 'sequential') {
    //Sequential mode: each indicator is rendered over its individual time domain
    for (let i = 0; i < render_targets.length; i++) {
      let target = render_targets[i]
      let layer = registry_layers[target.layerId]
      if (!layer && target.layerId.includes('.')) {
        let parent_id = target.layerId.split('.')[0]
        layer = registry_layers[parent_id]
      }

      let t_years: number[] = []
      if (keyframes_only && layer?.available_years && layer.available_years.length > 0) {
        for (let x = 0; x < layer.available_years.length; x++) {
          let yr = layer.available_years[x]
          if (yr >= start_year && yr <= end_year) {
            t_years.push(yr)
          }
        }
        t_years.sort((arg0_a, arg0_b) => arg0_a - arg0_b)
      }

      if (t_years.length === 0) {
        let step = Math.max(1, options.timestepStep || 1)
        for (let yr = start_year; yr <= end_year; yr += step) {
          t_years.push(yr)
        }
      }
      if (t_years.length === 0) {
        t_years = [start_year]
      }

      target_years.push(t_years)
      total_steps += t_years.length
    }
  } else {
    //Cycling mode: global timeline union across all active targets
    if (keyframes_only) {
      let keyframe_set = new Set<number>()
      for (let i = 0; i < render_targets.length; i++) {
        let target = render_targets[i]
        let layer = registry_layers[target.layerId]
        if (!layer && target.layerId.includes('.')) {
          let parent_id = target.layerId.split('.')[0]
          layer = registry_layers[parent_id]
        }
        if (layer?.available_years) {
          for (let x = 0; x < layer.available_years.length; x++) {
            let yr = layer.available_years[x]
            if (yr >= start_year && yr <= end_year) {
              keyframe_set.add(yr)
            }
          }
        }
      }
      if (keyframe_set.size > 0) {
        years_list = Array.from(keyframe_set).sort((arg0_a, arg0_b) => arg0_a - arg0_b)
      }
    }

    if (years_list.length === 0) {
      let step = Math.max(1, options.timestepStep || 1)
      for (let yr = start_year; yr <= end_year; yr += step) {
        years_list.push(yr)
      }
    }
    if (years_list.length === 0) {
      years_list = [start_year]
    }

    total_steps = render_targets.length*years_list.length
    for (let i = 0; i < render_targets.length; i++) {
      target_years.push(years_list)
    }
  }

  //Determine export zoom if not explicitly provided
  if (options.zoom !== undefined && options.zoom !== null) {
    export_zoom = options.zoom
  } else {
    if (projection === 'EqualEarth') {
      let ideal = Math.log2((export_h*0.96)/180)
      export_zoom = Math.max(1.0, Math.min(4.0, parseFloat(ideal.toFixed(2))))
    } else if (projection === 'Equirectangular') {
      let ideal = Math.log2(export_w/360)
      export_zoom = Math.max(1.0, Math.min(4.0, parseFloat(ideal.toFixed(2))))
    } else if (projection === 'Mercator') {
      export_zoom = 0.95
    } else if (projection === 'Globe') {
      export_zoom = 0
    } else {
      export_zoom = 2.85
    }
  }

  job_status = {
    currentFrame: 0,
    filename: clean_filename,
    jobId: job_id,
    message: `Initialising ${Math.min(concurrency, render_targets.length)} parallel headless render workers...`,
    progressPct: 0,
    status: 'rendering',
    totalFrames: total_steps,
  }
  active_jobs.set(job_id, job_status)
  active_browser_pools.set(job_id, active_browsers)

  //Run background rendering pipeline asynchronously
  ;(async () => {
    try {
      if (!fs.existsSync(frames_dir))
        fs.mkdirSync(frames_dir, { recursive: true })

      //Write manifest for resumability and inspection
      manifest_path = path.join(frames_dir, 'manifest.json')
      let manifest_data = {
        created_at: new Date().toISOString(),
        end_year,
        fps,
        height: export_h,
        keep_frames: keep_frames,
        mode: effective_mode,
        output_filename: clean_filename,
        projection,
        start_year,
        targets: render_targets.map((arg0_t, arg0_idx) => ({
          displayName: arg0_t.displayName,
          folderName: arg0_t.folderName,
          index: arg0_idx,
          layerId: arg0_t.layerId,
          selectors: arg0_t.selectors || {},
          years: target_years[arg0_idx],
        })),
        total_frames: total_steps,
        width: export_w,
        zoom: export_zoom,
      }
      fs.writeFileSync(manifest_path, JSON.stringify(manifest_data, null, 2))

      executable_path = findBrowserExecutable()

      //Initialise work queue with all target indices
      for (let i = 0; i < render_targets.length; i++) {
        target_queue.push(i)
      }

      let pool_size = Math.min(concurrency, render_targets.length)
      let target_url = `${client_url}/?export_mode=1&projection=${encodeURIComponent(projection)}&zoom=${export_zoom}&legend_position=${encodeURIComponent(legend_position)}`

      launch_args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',
        '--enable-webgl',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--hide-scrollbars',
        '--mute-audio',
        `--window-size=${export_w},${export_h}`,
      ]
      if (max_ram_mb > 0) {
        launch_args.push(`--js-flags=--max-old-space-size=${max_ram_mb}`)
      }

      /**
       * Individual worker routine that claims targets from the queue, launches a clean browser instance
       * for each target, renders all keyframes, and closes the browser upon completion to reclaim 100% of memory.
       *
       * @param {number} arg0_worker_id
       */
      let spawnWorker = async function (arg0_worker_id: number) {
        //Convert from parameters
        let worker_id = arg0_worker_id

        //Function body
        while (target_queue.length > 0 && !cancellation_tokens.has(job_id)) {
          let t_idx = target_queue.shift()
          if (t_idx === undefined)
            break

          let browser_instance: Browser | null = null
          let target = render_targets[t_idx]
          let sanitized_layer = target.layerId.replace(/[^a-zA-Z0-9_-]/g, '_')
          let target_dir = path.join(frames_dir, `target_${t_idx}_${sanitized_layer}`)
          let t_years = target_years[t_idx] || []

          if (!fs.existsSync(target_dir))
            fs.mkdirSync(target_dir, { recursive: true })

          try {
            browser_instance = await puppeteer.launch({
              args: launch_args,
              defaultViewport: {
                deviceScaleFactor: 1,
                height: export_h,
                width: export_w,
              },
              executablePath: executable_path,
              headless: true,
            })
            active_browsers.push(browser_instance)

            let page = await browser_instance.newPage()
            await page.setViewport({
              deviceScaleFactor: 1,
              height: export_h,
              width: export_w,
            })

            page.on('console', (arg0_msg) => {
              let text = arg0_msg.text()
              if (text.includes('error') || text.includes('Error') || text.includes('WebGL')) {
                console.warn(`[VideoRenderer Worker ${worker_id}]`, text)
              }
            })
            page.on('pageerror', (arg0_err) => {
              console.error(`[VideoRenderer Worker ${worker_id} PageError]`, arg0_err)
            })

            await page.goto(target_url, {
              timeout: 60000,
              waitUntil: 'domcontentloaded',
            })

            await page.waitForFunction(
              () => Boolean(document.querySelector('#deckgl-overlay')) && typeof (window as any).__renderKeyframe === 'function' && (window as any).__layersLoaded === true,
              { timeout: 30000 }
            )

            for (let x = 0; x < t_years.length; x++) {
              if (cancellation_tokens.has(job_id))
                break

              let yr = t_years[x]
              let frame_filename = `frame_${String(x).padStart(6, '0')}_${yr}.png`
              let frame_out_path = path.join(target_dir, frame_filename)

              //Resume optimization: if frame already rendered and valid, skip
              if (fs.existsSync(frame_out_path) && fs.statSync(frame_out_path).size > 1000) {
                completed_frames++
                job_status.currentFrame = completed_frames
                job_status.progressPct = Math.round((completed_frames / total_steps)*85)
                continue
              }

              //Instruct headless client to render keyframe
              await page.evaluate(
                async (arg0_layer, arg0_year, arg0_selectors) => {
                  if (typeof (window as any).__renderKeyframe === 'function') {
                    await (window as any).__renderKeyframe(arg0_layer, arg0_year, arg0_selectors)
                  }
                },
                target.layerId,
                yr,
                target.selectors || {}
              )

              //Wait for deck.gl to complete raster drawing to the framebuffer
              await page.evaluate(() => {
                return new Promise((arg0_res) => requestAnimationFrame(() => requestAnimationFrame(arg0_res)))
              })
              await new Promise((arg0_res) => setTimeout(arg0_res, 30))

              //Capture full-screen native GPU screenshot
              await page.screenshot({
                path: frame_out_path,
                type: 'png',
              })

              completed_frames++
              job_status.currentFrame = completed_frames
              job_status.progressPct = Math.round((completed_frames / total_steps)*85)
              job_status.message = `Rendering frame ${completed_frames}/${total_steps}: ${target.displayName} (${yr} AD)...`
            }
          } finally {
            if (browser_instance) {
              await browser_instance.close().catch(() => {})
              let b_idx = active_browsers.indexOf(browser_instance)
              if (b_idx !== -1)
                active_browsers.splice(b_idx, 1)
            }
          }
        }
      }

      for (let i = 0; i < pool_size; i++) {
        worker_promises.push(spawnWorker(i))
      }

      await Promise.all(worker_promises)
      active_browser_pools.delete(job_id)

      if (cancellation_tokens.has(job_id))
        return

      //Stitch rendered frames together into deterministic sequence for ffmpeg
      job_status.message = 'Stitching rendered frames together...'
      if (!fs.existsSync(stitched_dir))
        fs.mkdirSync(stitched_dir, { recursive: true })

      let frame_counter = 0

      if (effective_mode === 'cycling') {
        for (let yr_idx = 0; yr_idx < years_list.length; yr_idx++) {
          let yr = years_list[yr_idx]
          for (let t_idx = 0; t_idx < render_targets.length; t_idx++) {
            let target = render_targets[t_idx]
            let sanitized_layer = target.layerId.replace(/[^a-zA-Z0-9_-]/g, '_')
            let target_dir = path.join(frames_dir, `target_${t_idx}_${sanitized_layer}`)
            let src_file = path.join(target_dir, `frame_${String(yr_idx).padStart(6, '0')}_${yr}.png`)
            let dst_file = path.join(stitched_dir, `frame_${String(frame_counter).padStart(6, '0')}.png`)
            if (fs.existsSync(src_file))
              fs.copyFileSync(src_file, dst_file)
            frame_counter++
          }
        }
      } else {
        //Sequential mode: concatenate all frames of indicator 1, then indicator 2, etc.
        for (let t_idx = 0; t_idx < render_targets.length; t_idx++) {
          let target = render_targets[t_idx]
          let sanitized_layer = target.layerId.replace(/[^a-zA-Z0-9_-]/g, '_')
          let target_dir = path.join(frames_dir, `target_${t_idx}_${sanitized_layer}`)
          let t_years = target_years[t_idx] || []
          for (let x = 0; x < t_years.length; x++) {
            let yr = t_years[x]
            let src_file = path.join(target_dir, `frame_${String(x).padStart(6, '0')}_${yr}.png`)
            let dst_file = path.join(stitched_dir, `frame_${String(frame_counter).padStart(6, '0')}.png`)
            if (fs.existsSync(src_file))
              fs.copyFileSync(src_file, dst_file)
            frame_counter++
          }
        }
      }

      //Encode frames into MP4 with ffmpeg-static
      job_status.status = 'encoding'
      job_status.progressPct = 90
      job_status.message = 'Compiling stitched frames to H.264 MP4 video via ffmpeg...'

      ffmpeg_bin = ffmpegPath as string
      if (!ffmpeg_bin || !fs.existsSync(ffmpeg_bin))
        throw new Error(`ffmpeg-static binary not found at: ${ffmpeg_bin}`)

      let input_pattern = path.join(stitched_dir, 'frame_%06d.png')
      let ffmpeg_cmd = `"${ffmpeg_bin}" -y -framerate ${fps} -i "${input_pattern}" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast "${output_mp4_path}"`

      await new Promise<void>((arg0_resolve, arg0_reject) => {
        exec(ffmpeg_cmd, (arg0_err, _stdout, arg0_stderr) => {
          if (arg0_err) {
            console.error('[VideoRenderer] FFmpeg execution failed:', arg0_stderr)
            arg0_reject(new Error(`FFmpeg encoding error: ${arg0_err.message}`))
          } else {
            arg0_resolve()
          }
        })
      })

      //Clean up temporary stitched directory
      if (fs.existsSync(stitched_dir))
        fs.rmSync(stitched_dir, { force: true, recursive: true })

      //If user elected not to keep individual PNG frames, clean up the frames directory
      if (!keep_frames && fs.existsSync(frames_dir)) {
        try {
          fs.rmSync(frames_dir, { force: true, recursive: true })
        } catch {
          //Ignore cleanup errors
        }
      }

      let stats = fs.statSync(output_mp4_path)
      job_status.currentFrame = total_steps
      job_status.filename = clean_filename
      job_status.message = `Timelapse successfully compiled to exports/${clean_filename}`
      job_status.path = output_mp4_path
      job_status.progressPct = 100
      job_status.sizeBytes = stats.size
      job_status.status = 'complete'
      console.log(`[VideoRenderer] Completed timelapse export: ${output_mp4_path} (${stats.size} bytes)`)
    } catch (arg0_pipeline_err: any) {
      console.error('[VideoRenderer] Pipeline failed:', arg0_pipeline_err)
      job_status.error = arg0_pipeline_err?.message || 'Unknown rendering error'
      job_status.message = `Rendering failed: ${job_status.error}`
      job_status.status = 'error'

      let pool = active_browser_pools.get(job_id)
      if (pool) {
        for (let i = 0; i < pool.length; i++) {
          pool[i].close().catch(() => {})
        }
        active_browser_pools.delete(job_id)
      }

      if (fs.existsSync(stitched_dir)) {
        try {
          fs.rmSync(stitched_dir, { force: true, recursive: true })
        } catch {
          //Ignore cleanup errors
        }
      }
    } finally {
      cancellation_tokens.delete(job_id)
    }
  })()

  //Return statement
  return job_status
}
