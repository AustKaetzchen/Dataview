import { ColorPalette, ScaleType } from '@/lib/geopng/types'
import { ParsedDataLayer } from '@/server/layerParser'

/**
 * Maps raw JSON5 colourscheme strings to the corresponding D3 ColorPalette enum name.
 *
 * @param {string} [arg0_scheme]
 *
 * @returns {ColorPalette | null}
 */
export const mapColourschemeToPalette = function (arg0_scheme?: string): ColorPalette | null {
  //Convert from parameters
  let raw = arg0_scheme || ''

  //Declare local instance variables
  let s = raw.toLowerCase().replace(/[^a-z]/g, '')

  //Return statement
  if (s === 'rdylgn')
    return 'RdYlGn'
  if (s === 'turbo')
    return 'Turbo'
  if (s === 'cividis')
    return 'Cividis'
  if (s === 'plasma')
    return 'Plasma'
  if (s === 'reds')
    return 'Reds'
  if (s === 'blues')
    return 'Blues'
  if (s === 'ylorrd')
    return 'YlOrRd'
  if (s === 'ylgnbu')
    return 'YlGnBu'
  if (s === 'brbg')
    return 'BrBG'
  if (s === 'greens')
    return 'Greens'
  if (s === 'viridis')
    return 'Viridis'
  return null
}

/**
 * Applies legend configuration (colourscheme, inversion, scale type, steepness/sigma, units) from layer or active variable selector option.
 *
 * @param {ParsedDataLayer | null} arg0_layer
 * @param {Record<string, string | string[]>} arg1_selectors
 * @param {(arg0_palette: ColorPalette) => void} arg2_set_palette
 * @param {(arg0_invert: boolean) => void} arg3_set_invert
 * @param {(arg0_scale: ScaleType) => void} arg4_set_scale
 * @param {(arg0_title: string) => void} arg5_set_title
 * @param {(arg0_subtitle: string) => void} arg6_set_subtitle
 * @param {(arg0_sigma: number) => void} [arg7_set_log_sigma]
 */
export const applyLayerLegend = function (
  arg0_layer: ParsedDataLayer | null,
  arg1_selectors: Record<string, string | string[]>,
  arg2_set_palette: (arg0_palette: ColorPalette) => void,
  arg3_set_invert: (arg0_invert: boolean) => void,
  arg4_set_scale: (arg0_scale: ScaleType) => void,
  arg5_set_title: (arg0_title: string) => void,
  arg6_set_subtitle: (arg0_subtitle: string) => void,
  arg7_set_log_sigma?: (arg0_sigma: number) => void
) {
  //Convert from parameters
  let layer = arg0_layer
  let selectors = arg1_selectors
  let set_palette = arg2_set_palette
  let set_invert = arg3_set_invert
  let set_scale = arg4_set_scale
  let set_title = arg5_set_title
  let set_subtitle = arg6_set_subtitle
  let set_log_sigma = arg7_set_log_sigma

  //Guard clauses
  if (!layer)
    return

  //Declare local instance variables
  let candidate_legend: { colourscheme?: string; inverted?: boolean; steepness?: number; type?: string } | undefined
  let candidate_title = layer.name || layer.id
  let candidate_unit = layer.unit || ''
  let mapped_palette: ColorPalette | null = null

  //Function body
  if (layer.variable_selectors) {
    let sel_keys = Object.keys(layer.variable_selectors)
    let selected_option_names: string[] = []

    for (let i = 0; i < sel_keys.length; i++) {
      let sk = sel_keys[i]
      let opt_keys = Object.keys(layer.variable_selectors[sk]?.options || {})
      let raw_val = selectors[sk]
      let chosen_vals = Array.isArray(raw_val) ? raw_val : [raw_val || opt_keys[0] || '']
      let primary_val = chosen_vals[0] || ''
      if (primary_val && layer.variable_selectors[sk]?.options[primary_val]) {
        let opt = layer.variable_selectors[sk].options[primary_val]
        if (opt.legend)
          candidate_legend = opt.legend
        if (opt.name) {
          if (chosen_vals.length > 1) {
            selected_option_names.push(`${chosen_vals.length} selected`)
          } else if (opt.name === 'Total' && sel_keys.length > 1) {
            //Skip redundant Total when other specific cohort option is present
          } else {
            selected_option_names.push(opt.name)
          }
        }
      }
    }

    if (selected_option_names.length > 0)
      candidate_title = `${layer.name} (${selected_option_names.join(', ')})`
  }

  if (!candidate_legend)
    candidate_legend = layer.legend

  if (candidate_legend?.colourscheme) {
    mapped_palette = mapColourschemeToPalette(candidate_legend.colourscheme)
    if (mapped_palette)
      set_palette(mapped_palette)
  }

  if (candidate_legend?.inverted !== undefined)
    set_invert(candidate_legend.inverted)
  else
    set_invert(false)

  if (candidate_legend?.type) {
    let t = candidate_legend.type.toLowerCase()
    if (t === 'linear')
      set_scale('linear')
    else
      set_scale('pseudo-log')
  } else {
    set_scale('pseudo-log')
  }

  if (set_log_sigma) {
    if (candidate_legend?.steepness !== undefined && typeof candidate_legend.steepness === 'number' && !Number.isNaN(candidate_legend.steepness))
      set_log_sigma(candidate_legend.steepness)
    else
      set_log_sigma(1.0)
  }

  set_title(candidate_title)
  set_subtitle(candidate_unit)
}
