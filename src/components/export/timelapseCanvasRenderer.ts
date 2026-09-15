import { UfDate } from '@/lib/ufDate'

/**
 * Asynchronously loads an image from an absolute or relative URL.
 *
 * @param {string} arg0_url
 *
 * @returns {Promise<HTMLImageElement | null>}
 */
export const loadImageAsync = function (arg0_url: string): Promise<HTMLImageElement | null> {
  //Convert from parameters
  let url = arg0_url

  //Return statement
  return new Promise((arg0_resolve) => {
    let img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => arg0_resolve(img)
    img.onerror = () => arg0_resolve(null)
    img.src = url
  })
}

/**
 * Draws an elegant navigational compass rose at coordinates (cx, cy).
 *
 * @param {CanvasRenderingContext2D} arg0_ctx
 * @param {number} arg1_cx
 * @param {number} arg2_cy
 * @param {number} arg3_radius
 */
export const drawCompassRose = function (
  arg0_ctx: CanvasRenderingContext2D,
  arg1_cx: number,
  arg2_cy: number,
  arg3_radius: number
) {
  //Convert from parameters
  let ctx = arg0_ctx
  let cx = arg1_cx
  let cy = arg2_cy
  let radius = arg3_radius

  //Declare local instance variables
  let primary_r = radius
  let secondary_r = radius*0.55

  //Function body
  ctx.save()
  ctx.translate(cx, cy)

  //Circular backing ring
  ctx.beginPath()
  ctx.arc(0, 0, primary_r*0.65, 0, Math.PI*2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
  ctx.lineWidth = 1
  ctx.stroke()

  //Cardinal Points
  let points: [number, number, string][] = [
    [0, -primary_r, 'N'],
    [primary_r, 0, 'E'],
    [0, primary_r, 'S'],
    [-primary_r, 0, 'W'],
  ]

  for (let i = 0; i < 4; i++) {
    let angle = (i*Math.PI) / 2
    ctx.save()
    ctx.rotate(angle)

    //Right half of point (dark shade)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -primary_r)
    ctx.lineTo(primary_r*0.22, -primary_r*0.25)
    ctx.closePath()
    ctx.fillStyle = i === 0 ? 'rgba(239, 68, 68, 0.95)' : 'rgba(255, 255, 255, 0.85)'
    ctx.fill()

    //Left half of point (light shade)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -primary_r)
    ctx.lineTo(-primary_r*0.22, -primary_r*0.25)
    ctx.closePath()
    ctx.fillStyle = i === 0 ? 'rgba(185, 28, 28, 0.95)' : 'rgba(148, 163, 184, 0.75)'
    ctx.fill()

    ctx.restore()
  }

  //Intermediate Points (NE, SE, SW, NW)
  for (let i = 0; i < 4; i++) {
    let angle = (i*Math.PI) / 2 + Math.PI / 4
    ctx.save()
    ctx.rotate(angle)

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -secondary_r)
    ctx.lineTo(secondary_r*0.2, -secondary_r*0.25)
    ctx.closePath()
    ctx.fillStyle = 'rgba(203, 213, 225, 0.6)'
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -secondary_r)
    ctx.lineTo(-secondary_r*0.2, -secondary_r*0.25)
    ctx.closePath()
    ctx.fillStyle = 'rgba(100, 116, 139, 0.5)'
    ctx.fill()

    ctx.restore()
  }

  //Cardinal Letter Labels
  ctx.font = 'bold 9px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < points.length; i++) {
    let [px, py, label] = points[i]
    let offset_dist = primary_r + 8
    let lx = (px/primary_r)*offset_dist
    let ly = (py/primary_r)*offset_dist
    ctx.fillStyle = label === 'N' ? '#EF4444' : 'rgba(255, 255, 255, 0.8)'
    ctx.fillText(label, lx, ly)
  }

  ctx.restore()
}

/**
 * Renders a single frame of the timelapse onto the offscreen canvas context.
 *
 * @param {CanvasRenderingContext2D} arg0_ctx
 * @param {HTMLImageElement | null} arg1_image
 * @param {string} arg2_layer_title
 * @param {string} arg3_category_name
 * @param {number} arg4_year
 * @param {number} arg5_current_step
 * @param {number} arg6_total_steps
 * @param {number} arg7_start_year
 * @param {number} arg8_end_year
 */
export const renderTimelapseCanvasFrame = function (
  arg0_ctx: CanvasRenderingContext2D,
  arg1_image: HTMLImageElement | null,
  arg2_layer_title: string,
  arg3_category_name: string,
  arg4_year: number,
  arg5_current_step: number,
  arg6_total_steps: number,
  arg7_start_year: number,
  arg8_end_year: number
) {
  //Convert from parameters
  let category_name = arg3_category_name
  let ctx = arg0_ctx
  let current_step = arg5_current_step
  let end_year = arg8_end_year
  let image = arg1_image
  let layer_title = arg2_layer_title
  let start_year = arg7_start_year
  let total_steps = arg6_total_steps
  let year = arg4_year

  //Declare local instance variables
  let progress_ratio = total_steps > 0 ? (current_step + 1) / total_steps : 0
  let truncated_title = layer_title.length > 48 ? `${layer_title.slice(0, 45)}...` : layer_title

  //Function body
  ctx.fillStyle = '#060913'
  ctx.fillRect(0, 0, 1280, 720)

  if (image)
    ctx.drawImage(image, 0, 0, 1280, 720)

  //Compass rose in upper right corner
  drawCompassRose(ctx, 1235, 42, 18)

  //Title pill: Indicator Title & Category
  ctx.fillStyle = 'rgba(11, 15, 25, 0.88)'
  ctx.fillRect(16, 16, 460, 52)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.strokeRect(16, 16, 460, 52)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 14px Inter, sans-serif'
  ctx.fillText(truncated_title, 26, 38)

  ctx.fillStyle = '#94A3B8'
  ctx.font = '11px Inter, sans-serif'
  ctx.fillText(category_name.toUpperCase(), 26, 56)

  //Timestamp pill
  let yr_str = UfDate.formatYear(year)
  ctx.font = 'bold 20px monospace'
  let text_w = ctx.measureText(yr_str).width
  let box_w = text_w + 32
  let box_h = 42
  let box_x = 1280 - box_w - 64
  let box_y = 16

  ctx.fillStyle = 'rgba(11, 15, 25, 0.88)'
  ctx.fillRect(box_x, box_y, box_w, box_h)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.strokeRect(box_x, box_y, box_w, box_h)

  ctx.fillStyle = '#38BDF8'
  ctx.fillText(yr_str, box_x + 16, box_y + 28)

  //Bottom Timeline Scrubber bar
  ctx.fillStyle = 'rgba(11, 15, 25, 0.88)'
  ctx.fillRect(0, 688, 1280, 32)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.beginPath()
  ctx.moveTo(0, 688)
  ctx.lineTo(1280, 688)
  ctx.stroke()

  //Progress track
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.fillRect(20, 696, 1240, 6)

  //Progress fill
  ctx.fillStyle = '#3B82F6'
  ctx.fillRect(20, 696, Math.max(2, 1240*progress_ratio), 6)

  //Scrubber labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.font = '10px monospace'
  ctx.fillText(`${UfDate.formatYear(start_year)}`, 20, 714)
  ctx.textAlign = 'right'
  ctx.fillText(`${UfDate.formatYear(end_year)}  [${current_step + 1}/${total_steps}]`, 1260, 714)
  ctx.textAlign = 'left'
}

export interface FramingPreviewOptions {
  colorPalette?: string
  legendPosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  legendSubtitle?: string
  legendTitle?: string
  maxVal?: number
  minVal?: number
  renderedCanvas?: HTMLCanvasElement | null
  resolution: string
  startYear: number
  timelineYear?: number
  zoom: number
}

/**
 * Draws the 16:9 safe-area framing preview canvas displaying map positioning relative to UI overlays.
 *
 * @param {HTMLCanvasElement} arg0_canvas
 * @param {FramingPreviewOptions} arg1_options
 */
export const drawFramingPreviewCanvas = function (
  arg0_canvas: HTMLCanvasElement,
  arg1_options: FramingPreviewOptions
) {
  //Convert from parameters
  let canvas = arg0_canvas
  let options = (arg1_options) ? arg1_options : {} as FramingPreviewOptions

  //Declare local instance variables
  let cb_h = 46
  let cb_w: number
  let cb_x = 8
  let cb_y = 8
  let ctx = canvas.getContext('2d')
  let date_str = UfDate.formatYear(options.timelineYear || options.startYear)
  let grad: CanvasGradient
  let h = 360
  let is_center_pos: boolean
  let map_h: number
  let map_w: number
  let map_x: number
  let map_y: number
  let res_w = options.resolution === '1440p' ? 2560 : options.resolution === '720p' ? 1280 : 1920
  let tb_h = 24
  let tb_w = Math.min(360, 640 - 40)
  let tb_x = (640 - tb_w) / 2
  let tb_y = h - 30
  let title_str = (options.legendTitle || 'Indicator Value')
  let w = 640

  //Guard clauses
  if (!ctx)
    return

  //Function body
  canvas.width = w
  canvas.height = h

  //1. Clear dark background
  ctx.fillStyle = '#0B0F19'
  ctx.fillRect(0, 0, w, h)

  //2. Draw graticule lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
  ctx.lineWidth = 1
  for (let x = 0; x <= w; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = 0; y <= h; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  //3. Draw map raster (scaled by resolution-aware zoom)
  map_w = w * (360 * Math.pow(2, options.zoom)) / res_w
  map_h = map_w / 2
  map_x = (w - map_w) / 2
  map_y = (h - map_h) / 2

  if (options.renderedCanvas) {
    try {
      ctx.drawImage(options.renderedCanvas, map_x, map_y, map_w, map_h)
    } catch {
      //Fallback if canvas draw fails
    }
  } else {
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)'
    ctx.lineWidth = 1.5
    ctx.fillRect(map_x, map_y, map_w, map_h)
    ctx.strokeRect(map_x, map_y, map_w, map_h)
  }

  //4. Draw 16:9 frame outline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 1
  ctx.strokeRect(1, 1, w - 2, h - 2)

  //5. Bottom-Centred Timeline Bar Mockup
  ctx.fillStyle = 'rgba(11, 15, 25, 0.95)'
  ctx.fillRect(tb_x, tb_y, tb_w, tb_h)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.strokeRect(tb_x, tb_y, tb_w, tb_h)

  //Date badge in center
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.fillRect(tb_x + (tb_w - 70) / 2, tb_y + 3, 70, 10)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 7px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(date_str, tb_x + tb_w / 2, tb_y + 11)
  ctx.textAlign = 'left'

  //Scrubber track & red progress line
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.fillRect(tb_x + 6, tb_y + 17, tb_w - 12, 2)
  ctx.fillStyle = '#EF4444'
  ctx.fillRect(tb_x + 6, tb_y + 17, (tb_w - 12) * 0.45, 2)

  //6. Colourbar Overlay Mockup
  is_center_pos = options.legendPosition === 'bottom-center' || options.legendPosition === 'top-center'
  cb_w = is_center_pos ? tb_w : 130
  if (options.legendPosition === 'bottom-center') {
    cb_x = (w - cb_w) / 2
    cb_y = tb_y - cb_h - 4
  } else if (options.legendPosition === 'bottom-left') {
    cb_x = 8
    cb_y = h - cb_h - 8
  } else if (options.legendPosition === 'bottom-right') {
    cb_x = w - cb_w - 8
    cb_y = h - cb_h - 8
  } else if (options.legendPosition === 'top-center') {
    cb_x = (w - cb_w) / 2
    cb_y = 8
  } else if (options.legendPosition === 'top-right') {
    cb_x = w - cb_w - 8
    cb_y = 8
  } else {
    //'top-left'
    cb_x = 8
    cb_y = 8
  }

  ctx.fillStyle = 'rgba(11, 15, 25, 0.92)'
  ctx.fillRect(cb_x, cb_y, cb_w, cb_h)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.strokeRect(cb_x, cb_y, cb_w, cb_h)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 8px Inter, sans-serif'
  if (title_str.length > 22)
    title_str = title_str.slice(0, 20) + '...'
  ctx.fillText(title_str, cb_x + 6, cb_y + 12)

  //Gradient bar
  grad = ctx.createLinearGradient(cb_x + 6, 0, cb_x + cb_w - 12, 0)
  grad.addColorStop(0, '#313695')
  grad.addColorStop(0.5, '#ffffbf')
  grad.addColorStop(1, '#a50026')
  ctx.fillStyle = grad
  ctx.fillRect(cb_x + 6, cb_y + 17, cb_w - 12, 7)

  ctx.fillStyle = '#94A3B8'
  ctx.font = '7px monospace'
  ctx.fillText(options.minVal !== undefined ? String(Math.round(options.minVal)) : '0', cb_x + 6, cb_y + 36)
  ctx.textAlign = 'right'
  ctx.fillText(options.maxVal !== undefined ? String(Math.round(options.maxVal)) : '100', cb_x + cb_w - 6, cb_y + 36)
  ctx.textAlign = 'left'
}

