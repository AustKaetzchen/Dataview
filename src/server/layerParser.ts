import fs from 'fs'
import path from 'path'
import JSON5 from 'json5'

export interface LayerVariableOption {
  name: string
  discounted?: boolean
  legend?: {
    colourscheme?: string
    inverted?: boolean
    steepness?: number
    type?: string
  }
}

export interface LayerVariableSelector {
  name: string
  options: Record<string, LayerVariableOption>
}

export interface ParsedDataLayer {
  available_years: number[]
  can_be_uninhabited?: boolean
  category?: string
  description?: string
  display_options?: Record<string, any>
  encoding: 'float32' | 'int32'
  filepath_template: string
  icon?: string
  id: string
  is_nested?: boolean
  legend?: {
    colourscheme?: string
    inverted?: boolean
    steepness?: number
    type?: string
  }
  name: string
  parent_id?: string
  permissions: string[]
  pixel_offset?: number | { covariate?: string; x?: number; y?: number }
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
 * Generates all Cartesian combinations of selector key-value pairs for a layer.
 *
 * @param {Record<string, LayerVariableSelector>} [arg0_selectors]
 *
 * @returns {Array<Record<string, string>>}
 */
export const generateSelectorCombinations = function (
  arg0_selectors?: Record<string, LayerVariableSelector>
): Array<Record<string, string>> {
  //Convert from parameters
  let selectors = arg0_selectors

  //Declare local instance variables
  let all_combos: Array<Record<string, string>> = [{}]
  let sel_keys: string[]

  //Guard clauses
  if (!selectors)
    return [{}]

  //Function body
  sel_keys = Object.keys(selectors)
  if (sel_keys.length === 0)
    return [{}]

  for (let i = 0; i < sel_keys.length; i++) {
    let key = sel_keys[i]
    let new_combos: Array<Record<string, string>> = []
    let opt_keys = Object.keys(selectors[key].options)

    for (let x = 0; x < all_combos.length; x++) {
      let base = all_combos[x]
      for (let y = 0; y < opt_keys.length; y++) {
        let opt = opt_keys[y]
        new_combos.push({
          ...base,
          [key]: opt,
        })
      }
    }

    all_combos = new_combos
  }

  //Return statement
  return all_combos
}

/**
 * Scans filesystem for raster files matching a layer template and its variable selectors, populating the cache.
 *
 * @param {string} arg0_template
 * @param {string} arg1_layer_id
 * @param {Map<string, string>} arg2_file_cache
 * @param {Record<string, LayerVariableSelector>} [arg3_selectors]
 *
 * @returns {number[]} - List of unique sorted available years
 */
export const scanLayerTemplate = function (
  arg0_template: string,
  arg1_layer_id: string,
  arg2_file_cache: Map<string, string>,
  arg3_selectors?: Record<string, LayerVariableSelector>
): number[] {
  //Convert from parameters
  let file_cache = arg2_file_cache
  let layer_id = arg1_layer_id
  let selectors = arg3_selectors
  let template = arg0_template

  //Declare local instance variables
  let all_combos: Array<Record<string, string>> = []
  let available_years_set = new Set<number>()

  //Function body
  all_combos = generateSelectorCombinations(selectors)

  for (let i = 0; i < all_combos.length; i++) {
    let combo = all_combos[i]
    let concrete_template = template
    let keys = Object.keys(combo)

    for (let x = 0; x < keys.length; x++) {
      let k = keys[x]
      concrete_template = concrete_template.replace(new RegExp(`(\\$\\{${k}\\}|\\{${k}\\})`, 'g'), combo[k])
    }
    concrete_template = normaliseLayerPath(concrete_template)

    let dir_path = path.dirname(concrete_template)
    let file_pattern = path.basename(concrete_template)

    if (!fs.existsSync(dir_path)) {
      //Attempt fallback: look for similarly named directory in parent folder
      let parent_dir = path.dirname(dir_path)
      let target_dir_name = path.basename(dir_path)
      if (fs.existsSync(parent_dir)) {
        let sub_dirs = fs.readdirSync(parent_dir)
        let matched_dir = sub_dirs.find((arg0_d) =>
          arg0_d.toLowerCase().includes(target_dir_name.toLowerCase()) ||
          target_dir_name.toLowerCase().includes(arg0_d.toLowerCase())
        )
        if (matched_dir) {
          dir_path = path.join(parent_dir, matched_dir)
        }
      }
    }

    if (!fs.existsSync(dir_path)) {
      console.warn(`[LayerParser] Directory does not exist on disk: ${dir_path}`)
      continue
    }

    let dir_files: string[] = []
    try {
      dir_files = fs.readdirSync(dir_path)
    } catch (arg0_err) {
      console.error(`[LayerParser] Error reading directory ${dir_path}:`, arg0_err)
      continue
    }

    let has_hyde_suffix = /(\$\{year\}\$\{hs\}|\{year\}\{hs\}|\$\{year\}\{hs\}|\{year\}\$\{hs\}|\$\{hs\}|\{hs\})/.test(file_pattern)

    //Construct regex from file pattern supporting both ${token} and {token} formats
    let regex_str = file_pattern
      .replace(/[.*+?^${}()|[\]\\]/g, (arg0_match) => {
        if (arg0_match === '$' || arg0_match === '{' || arg0_match === '}')
          return arg0_match
        return `\\${arg0_match}`
      })
      .replace(/(\$\{year\}\$\{hs\}|\{year\}\{hs\}|\$\{year\}\{hs\}|\{year\}\$\{hs\})/g, '(\\d+)(BC|AD)_number')
      .replace(/(\$\{year\}|\{year\})/g, '(-?\\d+)')
      .replace(/(\$\{profession\}|\{profession\})/g, '([a-zA-Z0-9_-]+)')
      .replace(/(\$\{gender\}|\{gender\})/g, '([a-zA-Z0-9_-]+)')
      .replace(/(\$\{indicator\}|\{indicator\})/g, '([a-zA-Z0-9_-]+)')
      .replace(/(\$\{age\}|\{age\})/g, '([a-zA-Z0-9_-]+)')
      .replace(/(\$\{hs\}|\{hs\})/g, '(BC|AD)_number')

    let is_first_combo = i === 0
    let scan_regex = new RegExp(`^${regex_str}$`, 'i')

    for (let x = 0; x < dir_files.length; x++) {
      let filename = dir_files[x]
      let match = filename.match(scan_regex)
      if (match) {
        let full_path = path.join(dir_path, filename)
        let yr: number

        if (has_hyde_suffix && match[2]) {
          let era = match[2].toUpperCase()
          let num_val = parseInt(match[1], 10)
          yr = (era === 'BC') ? -num_val : num_val
        } else {
          yr = parseInt(match[1], 10)
        }

        if (!Number.isNaN(yr)) {
          available_years_set.add(yr)

          //Cache mapping strategies
          if (keys.length > 0) {
            //Strategy 1: Canonical sorted key (e.g. layer:indicator=net_wealth:1950)
            let sorted_pairs = Object.keys(combo).sort().map((arg0_k) => `${arg0_k}=${combo[arg0_k]}`).join(':')
            file_cache.set(`${layer_id}:${sorted_pairs}:${yr}`, full_path)

            //Strategy 2: Sorted values key (e.g. layer:net_wealth:1950)
            let sorted_values = Object.keys(combo).sort().map((arg0_k) => combo[arg0_k]).join(':')
            file_cache.set(`${layer_id}:${sorted_values}:${yr}`, full_path)

            //Strategy 3: Legacy positional (e.g. layer:profession:gender:1950)
            if (combo.profession && combo.gender) {
              file_cache.set(`${layer_id}:${combo.profession}:${combo.gender}:${yr}`, full_path)
            }
            if (keys.length === 1) {
              let single_val = combo[keys[0]]
              file_cache.set(`${layer_id}:${single_val}:${yr}`, full_path)
            }

            //Strategy 4: Default fallback key (first combo)
            if (is_first_combo) {
              file_cache.set(`${layer_id}:${yr}`, full_path)
              if (combo.profession && combo.gender) {
                file_cache.set(`${layer_id}:agriculture:t:${yr}`, full_path)
              }
            }
          } else {
            file_cache.set(`${layer_id}:${yr}`, full_path)
          }
        }
      }
    }
  }

  //Return statement
  return Array.from(available_years_set).sort((arg0_a, arg0_b) => arg0_a - arg0_b)
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

  //Return statement
  return scanLayerTemplate(path.join(dir_path, pattern), layer_id, file_cache)
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
  if (id.includes('age_sex'))
    return 'people'
  if (id.includes('birth'))
    return 'child_care'
  if (id.includes('death'))
    return 'heart_broken'
  if (id.includes('migration'))
    return 'flight_takeoff'
  if (id.includes('density'))
    return 'grain'
  if (id.includes('rural'))
    return 'park'
  if (id.includes('stadester') || id.includes('city') || id.includes('cities'))
    return 'location_city'
  if (id.includes('urban'))
    return 'apartment'
  if (id.includes('population'))
    return 'groups'
  if (id.includes('wealth') || id.includes('income'))
    return 'payments'
  if (id.includes('cropland') || id.includes('cultivation') || id.includes('crop'))
    return 'agriculture'
  if (id.includes('pasture') || id.includes('grazing') || id.includes('rangeland'))
    return 'grass'
  if (id.includes('rice'))
    return 'grain'
  if (id.includes('irri') || id.includes('rainfed'))
    return 'water_drop'
  if (id.includes('alcc') || id.includes('landuse') || id.includes('shifting'))
    return 'terrain'
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
    let dataset_name = (typeof parsed_json.name === 'string') ? parsed_json.name : path.basename(file_name, '.json5')

    //Extract root_folders
    let raw_roots = parsed_json.root_folders || {}
    let file_roots = resolveRootFolders(raw_roots)
    resolved_roots = { ...resolved_roots, ...file_roots }

    //Iterate over layer definitions
    let layer_keys = Object.keys(parsed_json).filter(
      (arg0_k) => !['root_folders', 'name', 'expressions'].includes(arg0_k)
    )
    let metadata_keys = [
      'description',
      'encoding',
      'filepath',
      'legend',
      'name',
      'permissions',
      'pixel_offset',
      'root_folders',
      'type',
      'unit',
      'variable_selectors',
    ]

    for (let x = 0; x < layer_keys.length; x++) {
      let k = layer_keys[x]
      let item = parsed_json[k]

      if (typeof item !== 'object' || item === null)
        continue

      let has_filepath = Boolean(item.filepath)
      let sub_keys = Object.keys(item).filter(
        (arg0_sk) =>
          typeof item[arg0_sk] === 'object' &&
          item[arg0_sk] !== null &&
          item[arg0_sk].filepath &&
          !metadata_keys.includes(arg0_sk)
      )
      let has_sub_layers = sub_keys.length > 0
      let is_vector_layer = typeof item.type === 'string' && item.type.startsWith('vector.')

      if (has_filepath || has_sub_layers || is_vector_layer) {
        //Resolve filepath template with root folders
        let resolved_template = item.filepath || ''
        let root_keys = Object.keys(resolved_roots)

        if (has_filepath) {
          for (let y = 0; y < root_keys.length; y++) {
            let rk = root_keys[y]
            resolved_template = resolved_template.replace(new RegExp(`(\\$\\{${rk}\\}|\\{${rk}\\})`, 'g'), resolved_roots[rk])
          }
          resolved_template = normaliseLayerPath(resolved_template)
        }

        //Extract variable selectors (either from variable_selectors or top-level properties)
        let selectors: Record<string, LayerVariableSelector> | undefined = undefined
        if (item.variable_selectors) {
          selectors = {}
          let sel_keys = Object.keys(item.variable_selectors)
          for (let z = 0; z < sel_keys.length; z++) {
            let sk = sel_keys[z]
            let sel_def = item.variable_selectors[sk]
            let opt_keys = Object.keys(sel_def).filter((arg0_opt) => arg0_opt !== 'name')
            if (opt_keys.length > 0 && opt_keys.every((arg0_opt) => !Number.isNaN(parseInt(arg0_opt, 10))))
              opt_keys.sort((arg0_a, arg0_b) => parseInt(arg0_a, 10) - parseInt(arg0_b, 10))
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
        } else {
          //Check top-level properties for selectors (e.g. gender and age in age_sex)
          let item_keys = Object.keys(item)
          for (let z = 0; z < item_keys.length; z++) {
            let ik = item_keys[z]
            if (metadata_keys.includes(ik))
              continue
            let candidate_sel = item[ik]
            if (typeof candidate_sel === 'object' && candidate_sel !== null && !candidate_sel.filepath) {
              let opt_keys = Object.keys(candidate_sel).filter((arg0_opt) => arg0_opt !== 'name')
              if (opt_keys.length > 0) {
                if (opt_keys.every((arg0_opt) => !Number.isNaN(parseInt(arg0_opt, 10))))
                  opt_keys.sort((arg0_a, arg0_b) => parseInt(arg0_a, 10) - parseInt(arg0_b, 10))
                if (!selectors)
                  selectors = {}
                let options_record: Record<string, LayerVariableOption> = {}
                for (let a = 0; a < opt_keys.length; a++) {
                  let ok = opt_keys[a]
                  let opt_val = candidate_sel[ok]
                  options_record[ok] = {
                    discounted: opt_val.discounted,
                    legend: opt_val.legend,
                    name: opt_val.name || ok,
                  }
                }
                selectors[ik] = {
                  name: candidate_sel.name || ik,
                  options: options_record,
                }
              }
            }
          }
        }

        //Determine layer type
        let layer_type = 'raster'
        if (item.type) {
          layer_type = item.type
        } else if (k.includes('professions') || k.includes('profession')) {
          layer_type = 'raster.category_profession'
        } else if (k.includes('age_sex') || item.type === 'raster.age_sex') {
          layer_type = 'raster.age_sex'
        } else if (k.includes('population') || k.includes('birth') || k.includes('death') || k.includes('migration')) {
          layer_type = 'raster.population'
        }

        //Scan files and discover available years using scanLayerTemplate if template exists and is raster
        let years: number[] = []
        if (layer_type.startsWith('vector.')) {
          years = [-10000, 2025]
          if (has_filepath)
            file_cache.set(k, resolved_template)
        } else if (has_filepath) {
          years = scanLayerTemplate(resolved_template, k, file_cache, selectors)
        }

        //Determine description
        let desc_text: string | undefined = undefined
        if (Array.isArray(item.description)) {
          desc_text = item.description.join('\n\n')
        } else if (typeof item.description === 'string') {
          desc_text = item.description
        }

        //Check for sub-layers (e.g. labourforce_female/male, lfpr_female/male)
        let sub_layer_list: ParsedDataLayer[] = []

        for (let b = 0; b < sub_keys.length; b++) {
          let sub_k = sub_keys[b]
          let sub_item = item[sub_k]
          let sub_template = sub_item.filepath

          for (let y = 0; y < root_keys.length; y++) {
            let rk = root_keys[y]
            sub_template = sub_template.replace(new RegExp(`(\\$\\{${rk}\\}|\\{${rk}\\})`, 'g'), resolved_roots[rk])
          }
          sub_template = normaliseLayerPath(sub_template)

          let sub_full_id = `${k}.${sub_k}`
          let sub_years = scanLayerTemplate(sub_template, sub_full_id, file_cache, sub_item.variable_selectors || selectors)

          sub_layer_list.push({
            available_years: sub_years,
            can_be_uninhabited: Boolean(sub_item.can_be_uninhabited ?? item.can_be_uninhabited ?? parsed_json.can_be_uninhabited),
            category: dataset_name,
            encoding: sub_item.encoding || 'float32',
            filepath_template: sub_template,
            icon: getLayerIcon(sub_k),
            id: sub_full_id,
            is_nested: true,
            legend: sub_item.legend,
            name: sub_item.name || sub_k,
            parent_id: k,
            permissions: sub_item.permissions ? (Array.isArray(sub_item.permissions) ? sub_item.permissions : [sub_item.permissions]) : ['default'],
            pixel_offset: sub_item.pixel_offset ?? item.pixel_offset,
            type: sub_item.type || layer_type,
            unit: sub_item.unit || item.unit,
          })
        }

        //If parent has no direct filepath, inherit years from sublayers
        if (!has_filepath && sub_layer_list.length > 0) {
          let year_set = new Set<number>()
          for (let s = 0; s < sub_layer_list.length; s++) {
            for (let y = 0; y < sub_layer_list[s].available_years.length; y++) {
              year_set.add(sub_layer_list[s].available_years[y])
            }
          }
          years = Array.from(year_set).sort((arg0_a, arg0_b) => arg0_a - arg0_b)
          resolved_template = sub_layer_list[0].filepath_template
        }

        parsed_layers[k] = {
          available_years: years,
          can_be_uninhabited: Boolean(item.can_be_uninhabited ?? parsed_json.can_be_uninhabited),
          category: dataset_name,
          description: desc_text,
          display_options: item.display_options || parsed_json.display_options,
          encoding: item.encoding || 'float32',
          filepath_template: resolved_template,
          icon: getLayerIcon(k),
          id: k,
          legend: item.legend,
          name: item.name || k,
          permissions: item.permissions ? (Array.isArray(item.permissions) ? item.permissions : [item.permissions]) : ['default'],
          pixel_offset: item.pixel_offset,
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
