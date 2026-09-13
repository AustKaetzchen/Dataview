import fs from 'fs'
import path from 'path'
import JSON5 from 'json5'

export interface LayerVariableOption {
  name: string
  discounted?: boolean
  legend?: {
    colourscheme?: string
    inverted?: boolean
    type?: string
  }
}

export interface LayerVariableSelector {
  name: string
  options: Record<string, LayerVariableOption>
}

export interface ParsedDataLayer {
  available_years: number[]
  category?: string
  description?: string
  encoding: 'float32' | 'int32'
  filepath_template: string
  icon?: string
  id: string
  is_nested?: boolean
  legend?: {
    colourscheme?: string
    inverted?: boolean
    type?: string
  }
  name: string
  parent_id?: string
  permissions: string[]
  sub_layers?: ParsedDataLayer[]
  type: string
  unit?: string
  variable_selectors?: Record<string, LayerVariableSelector>
}

export interface LayerRegistryCache {
  file_cache: Map<string, string> // key: `${layer_id}:${var_combo}:${year}` -> absolute_path
  layers: Record<string, ParsedDataLayer>
  resolved_roots: Record<string, string>
}

/**
 * Normalises a resolved filesystem path and eliminates accidental duplicate path segments.
 *
 * @param {string} arg0_path
 *
 * @returns {string}
 */
export const normaliseLayerPath = function (arg0_path: string): string {
  //Convert from parameters
  let target_path = arg0_path

  //Declare local instance variables
  let cleaned = target_path.replace(/\\/g, '/')

  //Function body
  //Collapse duplicate histmap segments if present
  while (cleaned.includes('/histmap/histmap/'))
    cleaned = cleaned.replace('/histmap/histmap/', '/histmap/')
  while (cleaned.includes('histmap//histmap'))
    cleaned = cleaned.replace('histmap//histmap', 'histmap/')

  //Clean redundant double slashes (except initial protocol or drive)
  cleaned = cleaned.replace(/([^:])\/\/+/g, '$1/')

  //Return statement
  return path.normalize(cleaned)
}

/**
 * Resolves templated root folder paths recursively.
 *
 * @param {Record<string, string>} arg0_root_folders
 *
 * @returns {Record<string, string>}
 */
export const resolveRootFolders = function (
  arg0_root_folders: Record<string, string>
): Record<string, string> {
  //Convert from parameters
  let root_folders = arg0_root_folders

  //Declare local instance variables
  let all_keys = Object.keys(root_folders)
  let changed = true
  let max_iterations = 10
  let resolved_roots: Record<string, string> = { ...root_folders }

  //Function body
  while (changed && max_iterations > 0) {
    changed = false
    max_iterations--

    for (let i = 0; i < all_keys.length; i++) {
      let k = all_keys[i]
      let val = resolved_roots[k]
      let new_val = val.replace(/\$\{([^}]+)\}/g, (arg0_match, arg1_var) => {
        if (resolved_roots[arg1_var]) {
          changed = true
          return resolved_roots[arg1_var]
        }
        return arg0_match
      })
      resolved_roots[k] = new_val
    }
  }

  //Normalise all paths
  for (let i = 0; i < all_keys.length; i++) {
    let k = all_keys[i]
    resolved_roots[k] = normaliseLayerPath(resolved_roots[k])
  }

  //Return statement
  return resolved_roots
}

/**
 * Parses and indexes a directory of GeoPNG files corresponding to a data layer.
 *
 * @param {string} arg0_dir_path
 * @param {string} arg1_pattern
 * @param {string} arg2_layer_id
 * @param {Map<string, string>} arg3_file_cache
 *
 * @returns {number[]} - List of unique sorted available years
 */
export const scanLayerDirectory = function (
  arg0_dir_path: string,
  arg1_pattern: string,
  arg2_layer_id: string,
  arg3_file_cache: Map<string, string>
): number[] {
  //Convert from parameters
  let dir_path = normaliseLayerPath(arg0_dir_path)
  let file_cache = arg3_file_cache
  let layer_id = arg2_layer_id
  let pattern = arg1_pattern

  //Declare local instance variables
  let all_files: string[] = []
  let available_years_set = new Set<number>()
  let regex_str: string
  let scan_regex: RegExp

  //Guard clauses
  if (!fs.existsSync(dir_path)) {
    console.warn(`[LayerParser] Directory does not exist on disk: ${dir_path}`)
    return []
  }

  //Function body
  try {
    all_files = fs.readdirSync(dir_path)
  } catch (arg0_err) {
    console.error(`[LayerParser] Error reading directory ${dir_path}:`, arg0_err)
    return []
  }

  //Construct regex from pattern (e.g. "GDP_pc_${year}.png" -> "^GDP_pc_(-?\\d+)\\.png$")
  regex_str = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, (arg0_match) => {
      if (arg0_match === '$')
        return '$'
      if (arg0_match === '{')
        return '{'
      if (arg0_match === '}')
        return '}'
      return `\\${arg0_match}`
    })
    .replace(/\$\{year\}/g, '(-?\\d+)')
    .replace(/\$\{profession\}/g, '([a-zA-Z0-9_-]+)')
    .replace(/\$\{gender\}/g, '([a-zA-Z0-9_-]+)')

  scan_regex = new RegExp(`^${regex_str}$`, 'i')

  for (let i = 0; i < all_files.length; i++) {
    let filename = all_files[i]
    let match = filename.match(scan_regex)
    if (match) {
      let full_path = path.join(dir_path, filename)
      let parsed_year: number | null = null

      if (pattern.includes('${profession}') && pattern.includes('${gender}') && pattern.includes('${year}')) {
        let prof = match[1]
        let gen = match[2]
        let yr = parseInt(match[3], 10)
        parsed_year = yr
        file_cache.set(`${layer_id}:${prof}:${gen}:${yr}`, full_path)
      } else if (pattern.includes('${year}')) {
        let yr = parseInt(match[1], 10)
        parsed_year = yr
        file_cache.set(`${layer_id}:${yr}`, full_path)
      }

      if (parsed_year !== null && !Number.isNaN(parsed_year))
        available_years_set.add(parsed_year)
    }
  }

  //Return statement
  return Array.from(available_years_set).sort((arg0_a, arg0_b) => arg0_a - arg0_b)
}

/**
 * Determines the primary semantic icon for a layer based on its identifier and category.
 *
 * @param {string} arg0_layer_id
 *
 * @returns {string}
 */
export const getLayerIcon = function (arg0_layer_id: string): string {
  //Convert from parameters
  let id = arg0_layer_id.toLowerCase()

  //Return statement
  if (id.includes('gdp'))
    return 'trending-up'
  if (id.includes('gini'))
    return 'percent'
  if (id.includes('labourforce') || id.includes('lfpr'))
    return 'users'
  if (id.includes('profession'))
    return 'briefcase'
  if (id.includes('population'))
    return 'user-check'
  return 'layers'
}

/**
 * Main parser function to load, resolve, and cache layers from config/layers.
 *
 * @param {string} arg0_config_dir
 *
 * @returns {LayerRegistryCache}
 */
export const loadAndParseLayers = function (arg0_config_dir: string): LayerRegistryCache {
  //Convert from parameters
  let config_dir = arg0_config_dir

  //Declare local instance variables
  let all_layer_files: string[] = []
  let file_cache = new Map<string, string>()
  let layers_dir = path.join(config_dir, 'layers')
  let parsed_layers: Record<string, ParsedDataLayer> = {}
  let resolved_roots: Record<string, string> = {}

  //Guard clauses
  if (!fs.existsSync(layers_dir)) {
    console.warn(`[LayerParser] Layers directory not found: ${layers_dir}`)
    return { file_cache, layers: parsed_layers, resolved_roots }
  }

  //Function body
  all_layer_files = fs.readdirSync(layers_dir).filter((arg0_f) => arg0_f.endsWith('.json5'))

  for (let i = 0; i < all_layer_files.length; i++) {
    let file_name = all_layer_files[i]
    let full_path = path.join(layers_dir, file_name)
    let raw_text = fs.readFileSync(full_path, 'utf-8')
    let parsed_json = JSON5.parse(raw_text)

    //Extract root_folders
    let raw_roots = parsed_json.root_folders || {}
    let file_roots = resolveRootFolders(raw_roots)
    resolved_roots = { ...resolved_roots, ...file_roots }

    //Iterate over layer definitions
    let layer_keys = Object.keys(parsed_json).filter((arg0_k) => arg0_k !== 'root_folders')

    for (let x = 0; x < layer_keys.length; x++) {
      let k = layer_keys[x]
      let item = parsed_json[k]

      if (typeof item === 'object' && item !== null && item.filepath) {
        //Resolve filepath template with root folders
        let resolved_template = item.filepath
        let root_keys = Object.keys(resolved_roots)

        for (let y = 0; y < root_keys.length; y++) {
          let rk = root_keys[y]
          resolved_template = resolved_template.replace(new RegExp(`\\$\\{${rk}\\}`, 'g'), resolved_roots[rk])
        }
        resolved_template = normaliseLayerPath(resolved_template)

        let dir_part = path.dirname(resolved_template)
        let file_part = path.basename(resolved_template)

        //Scan files and discover available years
        let years = scanLayerDirectory(dir_part, file_part, k, file_cache)

        //Determine layer type
        let layer_type = 'raster'
        if (k.includes('professions') || k.includes('profession')) {
          layer_type = 'raster.category_profession'
        } else if (k.includes('population')) {
          layer_type = 'raster.population'
        } else if (k.includes('age_sex')) {
          layer_type = 'raster.age_sex'
        }

        //Determine description
        let desc_text: string | undefined = undefined
        if (Array.isArray(item.description)) {
          desc_text = item.description.join('\n\n')
        } else if (typeof item.description === 'string') {
          desc_text = item.description
        }

        //Extract variable selectors
        let selectors: Record<string, LayerVariableSelector> | undefined = undefined
        if (item.variable_selectors) {
          selectors = {}
          let sel_keys = Object.keys(item.variable_selectors)
          for (let z = 0; z < sel_keys.length; z++) {
            let sk = sel_keys[z]
            let sel_def = item.variable_selectors[sk]
            let opt_keys = Object.keys(sel_def).filter((arg0_opt) => arg0_opt !== 'name')
            let options_record: Record<string, LayerVariableOption> = {}

            for (let a = 0; a < opt_keys.length; a++) {
              let ok = opt_keys[a]
              let opt_val = sel_def[ok]
              options_record[ok] = {
                discounted: opt_val.discounted,
                legend: opt_val.legend,
                name: opt_val.name || ok,
              }
            }

            selectors[sk] = {
              name: sel_def.name || sk,
              options: options_record,
            }
          }
        }

        //Check for sub-layers (e.g. labourforce_female, labourforce_male in labourforce_total)
        let sub_layer_list: ParsedDataLayer[] = []
        let sub_keys = Object.keys(item).filter(
          (arg0_sk) =>
            typeof item[arg0_sk] === 'object' &&
            item[arg0_sk] !== null &&
            item[arg0_sk].filepath &&
            arg0_sk !== 'legend' &&
            arg0_sk !== 'variable_selectors'
        )

        for (let b = 0; b < sub_keys.length; b++) {
          let sub_k = sub_keys[b]
          let sub_item = item[sub_k]
          let sub_template = sub_item.filepath

          for (let y = 0; y < root_keys.length; y++) {
            let rk = root_keys[y]
            sub_template = sub_template.replace(new RegExp(`\\$\\{${rk}\\}`, 'g'), resolved_roots[rk])
          }
          sub_template = normaliseLayerPath(sub_template)

          let sub_dir = path.dirname(sub_template)
          let sub_file = path.basename(sub_template)
          let sub_full_id = `${k}.${sub_k}`
          let sub_years = scanLayerDirectory(sub_dir, sub_file, sub_full_id, file_cache)

          sub_layer_list.push({
            available_years: sub_years,
            category: item.name,
            encoding: sub_item.encoding || 'float32',
            filepath_template: sub_template,
            icon: getLayerIcon(sub_k),
            id: sub_full_id,
            is_nested: true,
            legend: sub_item.legend,
            name: sub_item.name || sub_k,
            parent_id: k,
            permissions: sub_item.permissions ? (Array.isArray(sub_item.permissions) ? sub_item.permissions : [sub_item.permissions]) : ['default'],
            type: layer_type,
            unit: sub_item.unit || item.unit,
          })
        }

        parsed_layers[k] = {
          available_years: years,
          category: layer_type.startsWith('raster.category_') ? 'Occupations & Categories' : 'Historical Macroeconomic Rasters',
          description: desc_text,
          encoding: item.encoding || 'float32',
          filepath_template: resolved_template,
          icon: getLayerIcon(k),
          id: k,
          legend: item.legend,
          name: item.name || k,
          permissions: item.permissions ? (Array.isArray(item.permissions) ? item.permissions : [item.permissions]) : ['default'],
          sub_layers: sub_layer_list.length > 0 ? sub_layer_list : undefined,
          type: layer_type,
          unit: item.unit,
          variable_selectors: selectors,
        }
      }
    }
  }

  console.log(`[LayerParser] Successfully parsed ${Object.keys(parsed_layers).length} primary layers with ${file_cache.size} indexed raster keyframe files.`)

  //Return statement
  return {
    file_cache,
    layers: parsed_layers,
    resolved_roots,
  }
}
