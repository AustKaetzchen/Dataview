import fs from 'fs'
import path from 'path'

export interface CityIndexEntry {
  area?: Record<string, number>
  colour?: [number, number, number]
  coords: [number, number]
  country?: string
  density?: Record<string, number>
  elevation?: number
  id: number | string
  key: string
  max_pop: number
  max_year: number
  min_year: number
  name: string
  original_names?: string | string[]
  other_names?: string | string[]
  population?: Record<string, number>
  region?: string
  years: number[]
}

export interface StadesterQueryOptions {
  bbox?: [number, number, number, number] // [west, south, east, north]
  color_mode?: 'growth' | 'population' | 'continent'
  max_cities?: number
  min_pop?: number
}

export interface CompactCitiesPayload {
  coords: number[] // [lat0, lon0, lat1, lon1, ...]
  count: number
  countries: (string | undefined)[]
  growth: number[]
  keys: string[]
  names: string[]
  pops: number[]
}

export interface CityRenderPoint {
  area?: number
  colour?: [number, number, number]
  coords: [number, number]
  country?: string
  density?: number
  growthRate?: number
  id: number | string
  key: string
  name: string
  other_names?: string | string[]
  population: number
  region?: string
}

export const StadesterService = {
  datasets: new Map<string, Record<string, CityIndexEntry>>(),
  lite_cache_paths: new Map<string, string>(),

  /**
   * Resolves the absolute path to a Stadestér JSON dataset file.
   *
   * @param {string} [arg0_dataset_name='stadester_1.1']
   *
   * @returns {string}
   */
  getDatasetFilePath: function (arg0_dataset_name?: string): string {
    //Convert from parameters
    let dataset_name = (arg0_dataset_name) ? arg0_dataset_name : 'stadester_1.1'

    //Declare local instance variables
    let base_dir = path.resolve(process.cwd(), 'data/stadester')
    let file_name = dataset_name.endsWith('.json') ? dataset_name : `${dataset_name}.json`

    //Return statement
    return path.join(base_dir, file_name)
  },

  /**
   * Loads and indexes a Stadestér dataset into server memory.
   *
   * @param {string} [arg0_dataset_name='stadester_1.1']
   *
   * @returns {Record<string, CityIndexEntry>}
   */
  loadDataset: function (arg0_dataset_name?: string): Record<string, CityIndexEntry> {
    //Convert from parameters
    let dataset_name = (arg0_dataset_name) ? arg0_dataset_name : 'stadester_1.1'

    //Declare local instance variables
    let all_city_keys: string[]
    let file_path = StadesterService.getDatasetFilePath(dataset_name)
    let indexed_record: Record<string, CityIndexEntry> = {}
    let raw_data: Record<string, any>
    let raw_text: string

    //Guard clauses
    if (StadesterService.datasets.has(dataset_name))
      return StadesterService.datasets.get(dataset_name)!

    if (!fs.existsSync(file_path)) {
      console.warn(`[StadesterService] Dataset file not found: ${file_path}`)
      return {}
    }

    //Function body
    console.log(`[StadesterService] Indexing dataset ${dataset_name} from ${file_path}...`)
    raw_text = fs.readFileSync(file_path, 'utf-8')
    raw_data = JSON.parse(raw_text)
    all_city_keys = Object.keys(raw_data)

    for (let i = 0; i < all_city_keys.length; i++) {
      let key = all_city_keys[i]
      let c = raw_data[key]
      let pop_obj = c.population || {}
      let pop_years = Object.keys(pop_obj).map(Number).sort((arg0_a, arg0_b) => arg0_a - arg0_b)
      let min_yr = pop_years.length > 0 ? pop_years[0] : 0
      let max_yr = pop_years.length > 0 ? pop_years[pop_years.length - 1] : 0
      let max_p = 0

      for (let x = 0; x < pop_years.length; x++) {
        let p_val = pop_obj[pop_years[x]] || 0
        if (p_val > max_p)
          max_p = p_val
      }

      indexed_record[key] = {
        area: c.area,
        colour: c.colour,
        coords: c.coords,
        country: c.country,
        density: c.density,
        elevation: c.elevation,
        id: c.id !== undefined ? c.id : i + 1,
        key: c.key || key,
        max_pop: max_p,
        max_year: max_yr,
        min_year: min_yr,
        name: c.name || key,
        original_names: c.original_names,
        other_names: c.other_names,
        population: pop_obj,
        region: c.region,
        years: pop_years,
      }
    }

    StadesterService.datasets.set(dataset_name, indexed_record)
    console.log(`[StadesterService] Successfully indexed ${all_city_keys.length} cities for ${dataset_name}.`)

    //Return statement
    return indexed_record
  },

  /**
   * Ensures the lightweight static index cache exists on disk for immediate rendering.
   *
   * @param {string} [arg0_dataset_name='stadester_1.1']
   *
   * @returns {string} - Absolute path to cached lite JSON file
   */
  ensureLiteCache: function (arg0_dataset_name?: string): string {
    //Convert from parameters
    let dataset_name = (arg0_dataset_name) ? arg0_dataset_name : 'stadester_1.1'

    //Declare local instance variables
    let cache_dir = path.resolve(process.cwd(), 'data/stadester/cache')
    let lite_file_path = path.join(cache_dir, `${dataset_name}_lite.json`)
    let source_file_path = StadesterService.getDatasetFilePath(dataset_name)

    //Guard clauses
    if (fs.existsSync(lite_file_path) && fs.existsSync(source_file_path)) {
      let lite_stat = fs.statSync(lite_file_path)
      let src_stat = fs.statSync(source_file_path)
      if (lite_stat.mtimeMs >= src_stat.mtimeMs && lite_stat.size > 1000)
        return lite_file_path
    }

    //Function body
    if (!fs.existsSync(cache_dir))
      fs.mkdirSync(cache_dir, { recursive: true })

    let indexed = StadesterService.loadDataset(dataset_name)
    let all_keys = Object.keys(indexed)
    let lite_array: any[] = []

    for (let i = 0; i < all_keys.length; i++) {
      let c = indexed[all_keys[i]]
      lite_array.push({
        colour: c.colour,
        coords: c.coords,
        country: c.country,
        id: c.id,
        key: c.key,
        max_pop: c.max_pop,
        max_year: c.max_year,
        min_year: c.min_year,
        name: c.name,
        other_names: c.other_names,
        region: c.region,
      })
    }

    fs.writeFileSync(lite_file_path, JSON.stringify(lite_array), 'utf-8')
    console.log(`[StadesterService] Pre-cached lightweight index for ${dataset_name}: ${lite_file_path} (${(fs.statSync(lite_file_path).size / (1024*1024)).toFixed(2)} MB)`)

    //Return statement
    return lite_file_path
  },

  /**
   * Retrieves active cities interpolated at a specific historical year.
   *
   * @param {string} [arg0_dataset_name='stadester_1.1']
   * @param {number} [arg1_year=1950]
   * @param {StadesterQueryOptions} [arg2_options]
   *
   * @returns {CityRenderPoint[]}
   */
  getCitiesAtYear: function (
    arg0_dataset_name?: string,
    arg1_year?: number,
    arg2_options?: StadesterQueryOptions
  ): CityRenderPoint[] {
    //Convert from parameters
    let dataset_name = (arg0_dataset_name) ? arg0_dataset_name : 'stadester_1.1'
    let options = (arg2_options) ? arg2_options : {}
    let target_year = arg1_year !== undefined ? arg1_year : 1950

    //Declare local instance variables
    let all_city_keys: string[]
    let indexed = StadesterService.loadDataset(dataset_name)
    let max_cities = options.max_cities !== undefined ? options.max_cities : 4000
    let min_pop = options.min_pop !== undefined ? options.min_pop : 0
    let result_cities: CityRenderPoint[] = []

    //Guard clauses
    if (!indexed || Object.keys(indexed).length === 0)
      return []

    //Function body
    all_city_keys = Object.keys(indexed)

    for (let i = 0; i < all_city_keys.length; i++) {
      let city = indexed[all_city_keys[i]]
      let pop_years = city.years

      if (pop_years.length === 0 || !city.coords)
        continue

      if (options.bbox) {
        let b = options.bbox
        let c_lat = city.coords[0]
        let c_lon = city.coords[1]
        if (b[0] <= b[2]) {
          if (c_lon < b[0] || c_lon > b[2] || c_lat < b[1] || c_lat > b[3])
            continue
        } else {
          if ((c_lon < b[0] && c_lon > b[2]) || c_lat < b[1] || c_lat > b[3])
            continue
        }
      }

      let start_yr = city.min_year
      let end_yr = city.max_year

      //Allow cities alive at target_year (with 1975+ extension for modern metropolitan entries)
      let is_in_range = (target_year >= start_yr && target_year <= end_yr) ||
        (end_yr >= 1975 && target_year >= 1975 && target_year <= 2025)

      if (!is_in_range)
        continue

      let pop = 0
      let prev_yr = pop_years[0]
      let next_yr = pop_years[pop_years.length - 1]
      let growth_rate = 0

      //Interpolate population
      if (city.population && city.population[String(target_year)] !== undefined) {
        pop = city.population[String(target_year)]
      } else if (target_year <= start_yr) {
        pop = city.population ? (city.population[String(start_yr)] || 0) : 0
      } else if (target_year >= end_yr) {
        pop = city.population ? (city.population[String(end_yr)] || 0) : 0
      } else {
        for (let x = 0; x < pop_years.length - 1; x++) {
          if (target_year >= pop_years[x] && target_year <= pop_years[x + 1]) {
            prev_yr = pop_years[x]
            next_yr = pop_years[x + 1]
            break
          }
        }

        let p0 = city.population ? (city.population[String(prev_yr)] || 0) : 0
        let p1 = city.population ? (city.population[String(next_yr)] || 0) : 0

        if (p0 > 0 && p1 > 0 && next_yr > prev_yr) {
          let t = (target_year - prev_yr)/(next_yr - prev_yr)
          let log_val = Math.log10(p0) + t*(Math.log10(p1) - Math.log10(p0))
          pop = Math.round(Math.pow(10, log_val))
        } else if (p1 > 0) {
          pop = p1
        } else {
          pop = p0
        }
      }

      //Calculate continuous annual growth rate around target_year (logarithmic slope)
      if (city.population && pop_years.length > 1) {
        let g_next_yr = pop_years[pop_years.length - 1]
        let g_prev_yr = pop_years[0]

        if (target_year <= pop_years[0]) {
          g_prev_yr = pop_years[0]
          g_next_yr = pop_years[1]
        } else if (target_year >= pop_years[pop_years.length - 1]) {
          g_prev_yr = pop_years[pop_years.length - 2]
          g_next_yr = pop_years[pop_years.length - 1]
        } else {
          for (let x = 0; x < pop_years.length - 1; x++) {
            if (target_year >= pop_years[x] && target_year <= pop_years[x + 1]) {
              g_prev_yr = pop_years[x]
              g_next_yr = pop_years[x + 1]
              break
            }
          }
        }

        let gp0 = city.population[String(g_prev_yr)] || 0
        let gp1 = city.population[String(g_next_yr)] || 0

        if (gp0 > 0 && gp1 > 0 && g_next_yr > g_prev_yr) {
          growth_rate = Math.pow(gp1/gp0, 1/(g_next_yr - g_prev_yr)) - 1
        }
      }

      if (pop < min_pop || pop <= 0)
        continue

      //Resolve area and density at target year if available
      let area_val: number | undefined = undefined
      let density_val: number | undefined = undefined

      if (city.area) {
        if (city.area[String(target_year)] !== undefined) {
          area_val = city.area[String(target_year)]
        } else {
          let area_keys = Object.keys(city.area).map(Number).sort((arg0_a, arg0_b) => arg0_a - arg0_b)
          for (let y = area_keys.length - 1; y >= 0; y--) {
            if (area_keys[y] <= target_year) {
              area_val = city.area[String(area_keys[y])]
              break
            }
          }
          if (area_val === undefined && area_keys.length > 0)
            area_val = city.area[String(area_keys[0])]
        }
      }

      if (city.density) {
        if (city.density[String(target_year)] !== undefined) {
          density_val = city.density[String(target_year)]
        } else {
          let density_keys = Object.keys(city.density).map(Number).sort((arg0_a, arg0_b) => arg0_a - arg0_b)
          for (let z = density_keys.length - 1; z >= 0; z--) {
            if (density_keys[z] <= target_year) {
              density_val = city.density[String(density_keys[z])]
              break
            }
          }
          if (density_val === undefined && density_keys.length > 0)
            density_val = city.density[String(density_keys[0])]
        }
      }

      result_cities.push({
        area: area_val,
        colour: city.colour,
        coords: city.coords,
        country: city.country,
        density: density_val,
        growthRate: growth_rate,
        id: city.id,
        key: city.key,
        name: city.name,
        other_names: city.other_names,
        population: pop,
        region: city.region,
      })
    }

    //Sort descending by population
    result_cities.sort((arg0_a, arg0_b) => arg0_b.population - arg0_a.population)

    //Apply max_cities limit
    if (max_cities > 0 && max_cities < result_cities.length)
      result_cities = result_cities.slice(0, max_cities)

    //Return statement
    return result_cities
  },

  /**
   * Retrieves full historical information and timeseries for a given city key.
   *
   * @param {string} [arg0_dataset_name='stadester_1.1']
   * @param {string} arg1_city_key
   *
   * @returns {CityIndexEntry | null}
   */
  getCityByKey: function (arg0_dataset_name?: string, arg1_city_key?: string): CityIndexEntry | null {
    //Convert from parameters
    let city_key = arg1_city_key || ''
    let dataset_name = (arg0_dataset_name) ? arg0_dataset_name : 'stadester_1.1'

    //Declare local instance variables
    let indexed = StadesterService.loadDataset(dataset_name)

    //Guard clauses
    if (!city_key || !indexed)
      return null

    //Check direct key match
    if (indexed[city_key])
      return indexed[city_key]

    //Check common prefixes in raw JSON
    if (indexed['stadester-' + city_key])
      return indexed['stadester-' + city_key]
    if (indexed['ghsl-' + city_key])
      return indexed['ghsl-' + city_key]
    if (indexed['oxford-' + city_key])
      return indexed['oxford-' + city_key]

    //Fallback linear search by key, id or name
    let all_keys = Object.keys(indexed)
    for (let i = 0; i < all_keys.length; i++) {
      let entry = indexed[all_keys[i]]
      if (entry.key === city_key || String(entry.id) === city_key || entry.name === city_key)
        return entry
    }

    //Return statement
    return null
  },

  /**
   * Returns top N largest cities at a specific year for chart visualisations.
   *
   * @param {string} [arg0_dataset_name='stadester_1.1']
   * @param {number} [arg1_year=1950]
   * @param {number} [arg2_limit=20]
   *
   * @returns {CityRenderPoint[]}
   */
  getLargestCitiesAtYear: function (
    arg0_dataset_name?: string,
    arg1_year?: number,
    arg2_limit?: number
  ): CityRenderPoint[] {
    //Convert from parameters
    let dataset_name = (arg0_dataset_name) ? arg0_dataset_name : 'stadester_1.1'
    let limit = arg2_limit !== undefined ? arg2_limit : 20
    let year = arg1_year !== undefined ? arg1_year : 1950

    //Return statement
    return StadesterService.getCitiesAtYear(dataset_name, year, { max_cities: limit, min_pop: 0 })
  },

  /**
   * Returns compact columnar arrays for fast transfer and minimal JSON serialization overhead.
   *
   * @param {string} [arg0_dataset_name='stadester_1.1']
   * @param {number} [arg1_year=1950]
   * @param {StadesterQueryOptions} [arg2_options]
   *
   * @returns {CompactCitiesPayload}
   */
  getCompactCitiesAtYear: function (
    arg0_dataset_name?: string,
    arg1_year?: number,
    arg2_options?: StadesterQueryOptions
  ): CompactCitiesPayload {
    //Convert from parameters
    let dataset_name = (arg0_dataset_name) ? arg0_dataset_name : 'stadester_1.1'
    let options = (arg2_options) ? arg2_options : {}
    let year = arg1_year !== undefined ? arg1_year : 1950

    //Declare local instance variables
    let cities = StadesterService.getCitiesAtYear(dataset_name, year, options)
    let len = cities.length
    let coords: number[] = new Array(len * 2)
    let countries: (string | undefined)[] = new Array(len)
    let growth: number[] = new Array(len)
    let keys: string[] = new Array(len)
    let names: string[] = new Array(len)
    let pops: number[] = new Array(len)

    //Function body
    for (let i = 0; i < len; i++) {
      let c = cities[i]
      keys[i] = c.key
      names[i] = c.name
      countries[i] = c.country
      coords[i * 2] = c.coords[0]
      coords[i * 2 + 1] = c.coords[1]
      pops[i] = c.population
      growth[i] = c.growthRate !== undefined ? Math.round(c.growthRate * 10000) / 10000 : 0
    }

    //Return statement
    return {
      coords,
      count: len,
      countries,
      growth,
      keys,
      names,
      pops,
    }
  },
}

