import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import ffmpegPath from 'ffmpeg-static'

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
  endYear: number
  fps?: number
  height?: number
  mode: 'stationary' | 'cycling'
  outputFilename?: string
  projection?: string
  selectedLayers?: string[]
  startYear: number
  variableSelectors?: Record<string, string | string[]>
  width?: number
}

let active_jobs = new Map<string, TimelapseJobStatus>()
let active_browsers = new Map<string, Browser>()
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

  let browser = active_browsers.get(job_id)
  if (browser) {
    browser.close().catch(() => {})
    active_browsers.delete(job_id)
  }

  //Return statement
  return true
}

/**
 * Starts a server-side timelapse rendering job using headless Chrome and ffmpeg-static.
 *
 * @param {TimelapseRenderOptions} arg0_options
 * @param {string} arg0_exports_dir
 * @param {string} [arg0_client_url='http://localhost:5174']
 *
 * @returns {Promise<TimelapseJobStatus>}
 */
export const startTimelapseRenderJob = async function (
  arg0_options: TimelapseRenderOptions,
  arg0_exports_dir: string,
  arg0_client_url?: string
) {
  //Convert from parameters
  let client_url = arg0_client_url || 'http://localhost:5174'
  let exports_dir = path.resolve(arg0_exports_dir)
  let options = arg0_options

  //Declare local instance variables
  let base_name: string
  let browser: Browser | null = null
  let clean_filename: string
  let end_year = options.endYear
  let export_h = options.height || 1080
  let export_w = options.width || 1920
  let ffmpeg_bin: string
  let fps = options.fps || 30
  let job_id = `timelapse_${Date.now()}`
  let job_status: TimelapseJobStatus
  let layers_to_record: string[] = []
  let output_mp4_path: string
  let page: Page
  let projection = options.projection || 'EqualEarth'
  let start_year = options.startYear
  let temp_frames_dir: string
  let total_steps = 0
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
  temp_frames_dir = path.join(exports_dir, `temp_${job_id}`)

  if (options.mode === 'stationary') {
    layers_to_record = (options.selectedLayers && options.selectedLayers.length > 0)
      ? [options.selectedLayers[0]]
      : ['GDP_nominal_pc']
  } else {
    layers_to_record = (options.selectedLayers && options.selectedLayers.length > 0)
      ? options.selectedLayers
      : ['GDP_nominal_pc']
  }

  //Calculate sequence of years
  for (let yr = start_year; yr <= end_year; yr++) {
    years_list.push(yr)
  }
  if (years_list.length === 0)
    years_list = [start_year]

  total_steps = layers_to_record.length*years_list.length

  job_status = {
    currentFrame: 0,
    filename: clean_filename,
    jobId: job_id,
    message: 'Initialising headless Chrome renderer...',
    progressPct: 0,
    status: 'rendering',
    totalFrames: total_steps,
  }
  active_jobs.set(job_id, job_status)

  //Run background rendering pipeline asynchronously
  ;(async () => {
    try {
      if (!fs.existsSync(temp_frames_dir))
        fs.mkdirSync(temp_frames_dir, { recursive: true })

      let executable_path = findBrowserExecutable()

      browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--use-gl=angle',
          '--enable-unsafe-webgl',
          '--enable-webgl',
          '--hide-scrollbars',
          '--mute-audio',
          `--window-size=${export_w},${export_h}`,
        ],
        defaultViewport: {
          deviceScaleFactor: 1,
          height: export_h,
          width: export_w,
        },
        executablePath: executable_path,
        headless: true,
      })

      active_browsers.set(job_id, browser)

      page = await browser.newPage()
      await page.setViewport({
        deviceScaleFactor: 1,
        height: export_h,
        width: export_w,
      })

      //Navigate to export-specific client endpoint
      let target_url = `${client_url}/?export_mode=1&projection=${encodeURIComponent(projection)}`
      await page.goto(target_url, {
        timeout: 60000,
        waitUntil: 'domcontentloaded',
      })

      //Wait for Dataview app container and keyframe render helper
      await page.waitForFunction(
        () => Boolean(document.querySelector('#deckgl-overlay')) && typeof (window as any).__renderKeyframe === 'function' && (window as any).__layersLoaded === true,
        { timeout: 30000 }
      )

      let frame_counter = 0

      for (let l_idx = 0; l_idx < layers_to_record.length; l_idx++) {
        let layer_id = layers_to_record[l_idx]

        for (let y_idx = 0; y_idx < years_list.length; y_idx++) {
          let yr = years_list[y_idx]

          if (cancellation_tokens.has(job_id)) {
            job_status.status = 'cancelled'
            job_status.message = 'Rendering cancelled.'
            break
          }

          job_status.currentFrame = frame_counter + 1
          job_status.progressPct = Math.round(((frame_counter + 1) / total_steps)*85)
          job_status.message = `Rendering frame ${frame_counter + 1}/${total_steps}: ${layer_id} (${yr} AD)...`

          //Instruct headless client to render keyframe
          await page.evaluate(
            async (arg0_layer, arg0_year, arg0_selectors) => {
              if (typeof (window as any).__renderKeyframe === 'function') {
                await (window as any).__renderKeyframe(arg0_layer, arg0_year, arg0_selectors)
              }
            },
            layer_id,
            yr,
            options.variableSelectors || {}
          )

          //Wait for deck.gl to complete raster drawing to the framebuffer
          await page.evaluate(() => {
            return new Promise((arg0_res) => requestAnimationFrame(() => requestAnimationFrame(arg0_res)))
          })
          await new Promise((arg0_res) => setTimeout(arg0_res, 80))

          let frame_filename = `frame_${String(frame_counter).padStart(5, '0')}.png`
          let frame_out_path = path.join(temp_frames_dir, frame_filename)

          //Capture full-screen native GPU screenshot
          await page.screenshot({
            path: frame_out_path,
            type: 'png',
          })

          frame_counter++
        }
        if (cancellation_tokens.has(job_id))
          break
      }

      await browser.close()
      active_browsers.delete(job_id)

      if (cancellation_tokens.has(job_id)) {
        //Cleanup temp frames
        if (fs.existsSync(temp_frames_dir))
          fs.rmSync(temp_frames_dir, { force: true, recursive: true })
        return
      }

      //Encode frames into MP4 with ffmpeg-static
      job_status.status = 'encoding'
      job_status.progressPct = 90
      job_status.message = 'Compiling frames to H.264 MP4 video via ffmpeg...'

      ffmpeg_bin = ffmpegPath as string
      if (!ffmpeg_bin || !fs.existsSync(ffmpeg_bin))
        throw new Error(`ffmpeg-static binary not found at: ${ffmpeg_bin}`)

      let input_pattern = path.join(temp_frames_dir, 'frame_%05d.png')
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

      //Clean up temporary frame PNG files
      if (fs.existsSync(temp_frames_dir))
        fs.rmSync(temp_frames_dir, { force: true, recursive: true })

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

      if (browser) {
        try {
          await browser.close()
        } catch {
          //Ignore cleanup errors
        }
        active_browsers.delete(job_id)
      }

      if (fs.existsSync(temp_frames_dir)) {
        try {
          fs.rmSync(temp_frames_dir, { force: true, recursive: true })
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
