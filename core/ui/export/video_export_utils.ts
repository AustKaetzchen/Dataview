import { ParsedDataLayer } from '@server/layer_parser'

export type VideoExportMode = 'sequential' | 'cycling' | 'stationary'
export type TimestepUnit = 'years' | 'months' | 'days'

export interface CohortOption {
  key: string
  label: string
}

export interface IndicatorFolderItem {
  cohorts: CohortOption[]
  id: string
  isFolder: boolean
  name: string
}

export interface StartTimelapseExportOptions {
  concurrency?: number
  endYear: number
  filename: string
  fps: number
  height?: number
  keepFrames?: boolean
  keyframesOnly: boolean
  legendPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  maxRamPerThreadMb?: number
  mode: VideoExportMode
  projection?: string
  resumeFolder?: string
  selectedLayers: string[]
  startYear: number
  timestepStep: number
  width?: number
  zoom?: number
}

/**
 * Builds the nested indicator folder list for the video export indicator selector.
 *
 * @param {Record<string, ParsedDataLayer>} arg0_available_layers
 *
 * @returns {IndicatorFolderItem[]}
 */
export let buildIndicatorFolders = function (
  arg0_available_layers: Record<string, ParsedDataLayer>
): IndicatorFolderItem[] {
  //Convert from parameters
  let available_layers = arg0_available_layers

  //Declare local instance variables
  let keys = Object.keys(available_layers)
  let result: IndicatorFolderItem[] = []

  //Function body
  for (let i = 0; i < keys.length; i++) {
    let k = keys[i]
    let layer = available_layers[k]
    if (!layer)
      continue

    //1. Sub-layers (e.g. labourforce_total)
    if (layer.sub_layers && layer.sub_layers.length > 0) {
      result.push({
        cohorts: layer.sub_layers.map((arg0_sub: any) => ({
          key: arg0_sub.id,
          label: arg0_sub.name,
        })),
        id: k,
        isFolder: true,
        name: layer.name,
      })
      continue
    }

    //2. Professions
    if (k === 'professions_percentage' || k === 'professions_total') {
      let title_prefix = k === 'professions_percentage' ? 'Professions (%)' : 'Professions (Total)'
      result.push({
        cohorts: [
          { key: `${k}::profession=agriculture&gender=t`, label: 'Agriculture' },
          { key: `${k}::profession=informal_labour&gender=t`, label: 'Informal Labour' },
          { key: `${k}::profession=manufacturing&gender=t`, label: 'Manufacturing' },
          { key: `${k}::profession=services&gender=t`, label: 'Services' },
          { key: `${k}::profession=not_in_work&gender=t`, label: 'Not in Work' },
        ],
        id: k,
        isFolder: true,
        name: title_prefix,
      })
      continue
    }

    //3. Age/Sex
    if (k === 'age_sex') {
      let age_brackets = [
        { id: '00', name: '0-1yo' },
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
      let age_cohorts: CohortOption[] = []
      for (let x = 0; x < age_brackets.length; x++) {
        age_cohorts.push({
          key: `age_sex::gender=f&age=${age_brackets[x].id}`,
          label: `Female (${age_brackets[x].name})`,
        })
      }
      for (let x = 0; x < age_brackets.length; x++) {
        age_cohorts.push({
          key: `age_sex::gender=m&age=${age_brackets[x].id}`,
          label: `Male (${age_brackets[x].name})`,
        })
      }
      result.push({
        cohorts: age_cohorts,
        id: k,
        isFolder: true,
        name: 'Age/Sex (Total)',
      })
      continue
    }

    //4. Wealth/Income
    if (k === 'wealth_income') {
      result.push({
        cohorts: [
          { key: 'wealth_income::indicator=net_wealth', label: 'Net Wealth' },
          { key: 'wealth_income::indicator=net_income', label: 'Net Income' },
          { key: 'wealth_income::indicator=disposable_income', label: 'Disposable Income' },
          { key: 'wealth_income::indicator=discretionary_income', label: 'Discretionary Income' },
        ],
        id: k,
        isFolder: true,
        name: 'Wealth/Income',
      })
      continue
    }

    //5. Deaths
    if (k === 'deaths') {
      result.push({
        cohorts: [
          { key: 'deaths::gender=female', label: 'Female Deaths' },
          { key: 'deaths::gender=male', label: 'Male Deaths' },
        ],
        id: k,
        isFolder: true,
        name: 'Deaths',
      })
      continue
    }

    //6. Migration (Gender)
    if (k === 'migration_gender') {
      result.push({
        cohorts: [
          { key: 'migration_gender::gender=female', label: 'Female Migration' },
          { key: 'migration_gender::gender=male', label: 'Male Migration' },
        ],
        id: k,
        isFolder: true,
        name: 'Migration (Gender)',
      })
      continue
    }

    //7. Standalone layer
    result.push({
      cohorts: [{ key: k, label: layer.name || k }],
      id: k,
      isFolder: false,
      name: layer.name || k,
    })
  }

  //Return statement
  return result
}

/**
 * Returns default zoom heuristic for a given projection and resolution.
 *
 * @param {string} arg0_proj
 * @param {number} [arg1_w]
 * @param {number} [arg2_h]
 *
 * @returns {number}
 */
export let getDefaultExportZoom = function (
  arg0_proj: string,
  arg1_w?: number,
  arg2_h?: number
): number {
  //Convert from parameters
  let h = arg2_h || 1080
  let proj = arg0_proj
  let w = arg1_w || 1920

  //Return statement
  if (proj === 'Mercator') {
    let scale_x = Math.log2(w / 512)
    let scale_y = Math.log2(h / 512)
    return parseFloat(Math.min(scale_x, scale_y).toFixed(2))
  }
  if (proj === 'Globe') {
    let base = Math.min(w, h)
    return parseFloat(Math.max(0.5, Math.log2(base / 480)).toFixed(2))
  }
  if (proj === 'Equirectangular') {
    return parseFloat(Math.max(1.0, Math.log2(h / 360)).toFixed(2))
  }
  if (proj === 'EqualEarth') {
    return parseFloat(Math.max(1.0, Math.log2(h / 320)).toFixed(2))
  }
  return 1.8
}

/**
 * Resolves human-readable indicator label from layer key.
 *
 * @param {string} arg0_key
 * @param {IndicatorFolderItem[]} arg1_folders
 * @param {Record<string, ParsedDataLayer>} arg2_layers
 *
 * @returns {string}
 */
export let getIndicatorLabel = function (
  arg0_key: string,
  arg1_folders: IndicatorFolderItem[],
  arg2_layers: Record<string, ParsedDataLayer>
): string {
  //Convert from parameters
  let folders = arg1_folders
  let key = arg0_key
  let layers = arg2_layers

  //Function body
  for (let i = 0; i < folders.length; i++) {
    let f = folders[i]
    for (let x = 0; x < f.cohorts.length; x++) {
      if (f.cohorts[x].key === key) {
        if (f.isFolder)
          return `${f.name} › ${f.cohorts[x].label}`
        return f.cohorts[x].label
      }
    }
  }

  //Return statement
  return layers[key]?.name || key
}
