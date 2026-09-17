import JSON5 from 'json5'
import rawEnGb from './en_gb.json5?raw'
import rawFr from './fr.json5?raw'
import rawDe from './de.json5?raw'

export type SupportedLocale = 'en-GB' | 'fr' | 'de'

export interface LocalisationConfig {
  app: {
    badge: string
    subtitle: string
    title: string
  }
  settings: {
    basemapLayer: string
    colourbarPosition: string
    disabled: string
    enabled: string
    language: string
    performantDesc: string
    performantMode: string
    positions: {
      bottomCenter: string
      bottomLeft: string
      bottomRight: string
      topCenter: string
      topLeft: string
      topRight: string
    }
    projectionMode: string
    projections: {
      equalEarth: string
      equirectangular: string
      globe: string
      mercator: string
    }
    title: string
  }
  sidebar: {
    binning: {
      downsampleGrid: string
      downsampleMethod: string
      height: string
      methodAverage: string
      methodMaximum: string
      methodMinimum: string
      methodNear: string
      off: string
      on: string
      presets: string
      width: string
    }
    folders: {
      binning: string
      dataLayers: string
      description: string
      manualUpload: string
      visualisation: string
    }
    toolbar: {
      collapseSidebar: string
      expandSidebar: string
      info: string
      infoTooltip: string
      roles: {
        default: string
        developer: string
        privileged: string
      }
      video: string
      videoTooltip: string
    }
    upload: {
      chooseImageA: string
      chooseImageB: string
      difference: string
      encodingFormat: string
      firstImage: string
      firstPlaceholder: string
      mode: string
      secondImage: string
      secondPlaceholder: string
      selectSingle: string
      single: string
      singlePlaceholder: string
    }
    visualisation: {
      absoluteBreaks: string
      colorPalette: string
      invert: string
      legendSubtitle: string
      legendTitle: string
      linear: string
      logSigma: string
      manualRange: string
      max: string
      min: string
      optional: string
      percentileBreaks: string
      pseudoLog: string
      scaleTransformation: string
      subtitlePlaceholder: string
    }
  }
  hud: {
    coordinate: string
    graticule: string
    hideUi: string
    inspect: string
    resetView: string
    settings: string
    showUi: string
    value: string
  }
  mapmodes: {
    analyticalTools: string
    activeCount: string
    collapse: string
    expand: string
    haloDescription: string
    haloThicknessLabel: string
    haloThicknessUnit: string
    layersCount: string
    loadingRaster: string
    noResults: string
    off: string
    on: string
    searchPlaceholder: string
    title: string
  }
  timeline: {
    ad: string
    bc: string
    currentYear?: string
    loadingRaster: string
    loop: string
    pause: string
    play: string
    rasterReady: string
    settings: string
    snap: string
    speed: string
    stepBackward: string
    stepForward: string
    year: string
  }
  analytics: {
    breakdown: string
    clearFilter: string
    filter: string
    histogram: string
    keyframes: string
    largestCities: string
    maxValue: string
    mean: string
    median: string
    minValue: string
    noRasterDesc: string
    noRasterLoaded: string
    pyramid: string
    refresh: string
    resolution: string
    stdDev: string
    steepness: string
    summary: string
    title: string
    totalCells: string
    validCells: string
  }
  mobile: {
    analytics: string
    map: string
    settings: string
    sidebar: string
    timeline: string
  }
  videoExport: {
    close: string
    export: string
    format: string
    title: string
  }
}

export let LOCALISATION_DICTIONARIES: Record<SupportedLocale, LocalisationConfig> = {
  'de': JSON5.parse(rawDe),
  'en-GB': JSON5.parse(rawEnGb),
  'fr': JSON5.parse(rawFr),
}

export let LOCALISATION_CONFIG: LocalisationConfig = LOCALISATION_DICTIONARIES['en-GB']

/**
 * Formats a localized template string by replacing £1£, £2£ or £var_name£ delimiters.
 *
 * @param {string} arg0_template
 * @param {Record<string, string | number> | Array<string | number> | string | number} [arg1_params]
 * @param {Array<string | number>} [arg2_rest]
 *
 * @returns {string}
 */
export function formatLocalisedString (
  arg0_template: string,
  arg1_params?: Record<string, string | number> | Array<string | number> | string | number,
  ...arg2_rest: Array<string | number>
): string {
  //Convert from parameters
  let params = arg1_params
  let rest = arg2_rest
  let template = arg0_template

  //Declare local instance variables
  let result = template

  //Guard clauses
  if (!template)
    return ''
  if (params === undefined || params === null)
    return template

  //Function body
  if (Array.isArray(params)) {
    for (let i = 0; i < params.length; i++) {
      let placeholder = `£${i + 1}£`
      let val = String(params[i])
      result = result.split(placeholder).join(val)
    }
  } else if (typeof params === 'object') {
    let all_keys = Object.keys(params)
    for (let i = 0; i < all_keys.length; i++) {
      let key = all_keys[i]
      let placeholder = `£${key}£`
      let val = String((params as any)[key])
      result = result.split(placeholder).join(val)
    }
  } else {
    let all_values = [params, ...rest]
    for (let i = 0; i < all_values.length; i++) {
      let placeholder = `£${i + 1}£`
      let val = String(all_values[i])
      result = result.split(placeholder).join(val)
    }
  }

  //Return statement
  return result
}
