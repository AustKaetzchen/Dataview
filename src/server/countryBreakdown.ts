/**
 * Country demographic and economic category modeling service.
 * Provides historical cohort distributions for population pyramids and sector employment shares per country.
 */

export interface DemographicCohortResult {
  country: string
  dependencyRatio: number
  female: Record<string, number>
  male: Record<string, number>
  sexRatio: number
  totalFemale: number
  totalMale: number
}

export interface SectorBreakdownResult {
  byCountry: Record<string, Record<string, number>>
  global: Record<string, number>
}

//Demographic cohort IDs, duration widths in years, and cohort midpoint ages
let AGE_IDS = [
  '00', '01', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60', '65', '70', '75', '80'
]
let COHORT_WIDTHS = [1, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 7]
let COHORT_MID_AGES = [0.5, 3.0, 7.5, 12.5, 17.5, 22.5, 27.5, 32.5, 37.5, 42.5, 47.5, 52.5, 57.5, 62.5, 67.5, 72.5, 77.5, 84.0]

//Country demographic classification archetypes
let SUPER_AGED_COUNTRIES = new Set([
  'japan', 'germany', 'italy', 'spain', 'portugal', 'greece', 'south korea', 'korea', 'croatia', 'slovenia'
])

let MATURE_WESTERN_COUNTRIES = new Set([
  'united states', 'united states of america', 'usa', 'united kingdom', 'uk', 'france', 'canada', 'australia',
  'netherlands', 'sweden', 'norway', 'denmark', 'finland', 'switzerland', 'austria', 'belgium', 'new zealand', 'ireland'
])

let TRANSITION_EMERGING_COUNTRIES = new Set([
  'china', 'russia', 'russian federation', 'brazil', 'mexico', 'turkey', 'iran', 'thailand', 'vietnam', 'poland',
  'argentina', 'chile', 'colombia', 'romania', 'ukraine', 'czechia', 'czech republic', 'hungary'
])

let DEVELOPING_DIVIDEND_COUNTRIES = new Set([
  'india', 'indonesia', 'pakistan', 'bangladesh', 'philippines', 'egypt', 'south africa', 'peru', 'morocco',
  'algeria', 'saudi arabia', 'iraq', 'uzbekistan', 'malaysia', 'venezuela'
])

let HIGH_FERTILITY_COUNTRIES = new Set([
  'nigeria', 'ethiopia', 'dr congo', 'democratic republic of the congo', 'tanzania', 'kenya', 'uganda', 'sudan',
  'afghanistan', 'niger', 'mali', 'chad', 'angola', 'somalia', 'mozambique', 'madagascar', 'cameroon', 'yemen'
])

/**
 * Computes individual country population pyramid cohort values based on country archetype and historical year.
 *
 * @param {string} arg0_country
 * @param {number} arg1_year
 *
 * @returns {DemographicCohortResult}
 */
export function getCountryDemographicPyramid (
  arg0_country: string,
  arg1_year: number
): DemographicCohortResult {
  //Convert from parameters
  let country = arg0_country
  let year = arg1_year

  //Declare local instance variables
  let base_scale = 100
  let clean_name = country.toLowerCase().trim()
  let dependency_ratio: number
  let female_map: Record<string, number> = {}
  let male_map: Record<string, number> = {}
  let old_dep_count = 0
  let sex_ratio: number
  let total_female = 0
  let total_male = 0
  let total_pop: number
  let working_count = 0
  let youth_dep_count = 0

  //Determine country archetype
  let is_high_fertility = HIGH_FERTILITY_COUNTRIES.has(clean_name)
  let is_mature = MATURE_WESTERN_COUNTRIES.has(clean_name)
  let is_super_aged = SUPER_AGED_COUNTRIES.has(clean_name)
  let is_transition = TRANSITION_EMERGING_COUNTRIES.has(clean_name)

  //Function body
  for (let i = 0; i < AGE_IDS.length; i++) {
    let age = COHORT_MID_AGES[i]
    let cid = AGE_IDS[i]
    let cohort_w = COHORT_WIDTHS[i]
    let f_val: number
    let m_val: number

    //Smooth continuous demographic modeling
    let annual_density = 1.0

    if (year <= 1850) {
      //Classical pre-industrial high-mortality demographic regime
      annual_density = Math.exp(-age/32)
    } else if (is_super_aged && year >= 1990) {
      //Super-aged: low youth birth rate, high adult bulge at 45-65, low mortality until late 70s
      let birth_decline = Math.min(0.65, 0.45 + (year - 1990)*0.007)
      let youth_curve = 1 - birth_decline*Math.exp(-Math.pow(age/24, 2))
      let bulge = 1 + 0.35*Math.exp(-Math.pow((age - 52)/14, 2))
      let survival = Math.exp(-Math.pow(age/84, 5.5))
      annual_density = youth_curve*bulge*survival
    } else if (is_mature && year >= 1970) {
      //Mature Western: stable fertility, baby-boom bulge around 45-60, high longevity
      let birth_factor = 0.85 - 0.15*Math.exp(-Math.pow(age/22, 2))
      let bulge = 1 + 0.25*Math.exp(-Math.pow((age - 48)/16, 2))
      let survival = Math.exp(-Math.pow(age/82, 5.0))
      annual_density = birth_factor*bulge*survival
    } else if (is_transition && year >= 1990) {
      //Emerging transition: rapid fertility drop in youth, working-age dividend at 25-50
      let birth_factor = 0.70 - 0.30*Math.exp(-Math.pow(age/20, 2))
      let bulge = 1 + 0.30*Math.exp(-Math.pow((age - 38)/15, 2))
      let survival = Math.exp(-Math.pow(age/78, 4.5))
      annual_density = birth_factor*bulge*survival
    } else if (is_high_fertility) {
      //High fertility expansive pyramid
      let life_exp = year >= 1980 ? 46 : 38
      annual_density = Math.exp(-age/life_exp)
    } else {
      //Developing dividend / default
      let t_progress = Math.min(1, Math.max(0, (year - 1950)/75))
      let life_exp = 38 + t_progress*34
      let youth_factor = 1.0 - t_progress*0.25*Math.exp(-Math.pow(age/22, 2))
      let survival = Math.exp(-Math.pow(age/life_exp, 3.8))
      annual_density = youth_factor*survival
    }

    //Aggregate inhabitants in cohort band = base_scale * cohort_duration * annual_density
    let cohort_inhabitants = base_scale*cohort_w*annual_density

    //Gender split: males higher at birth (1.05), women outlive men in older cohorts
    let sex_bias = 1.05 - (age/90)*0.25
    m_val = Math.max(0.1, cohort_inhabitants*(sex_bias/(1 + sex_bias)))
    f_val = Math.max(0.1, cohort_inhabitants*(1/(1 + sex_bias)))

    male_map[cid] = Math.round(m_val*10)/10
    female_map[cid] = Math.round(f_val*10)/10

    total_male += male_map[cid]
    total_female += female_map[cid]

    if (i <= 3) {
      youth_dep_count += male_map[cid] + female_map[cid]
    } else if (i >= 14) {
      old_dep_count += male_map[cid] + female_map[cid]
    } else {
      working_count += male_map[cid] + female_map[cid]
    }
  }

  total_pop = youth_dep_count + working_count + old_dep_count
  sex_ratio = total_female > 0 ? Math.round((total_male/total_female)*1000)/1000 : 1.0
  dependency_ratio = total_pop > 0 ? Math.round(((youth_dep_count + old_dep_count)/total_pop)*1000)/10 : 35.0

  //Return statement
  return {
    country,
    dependencyRatio: dependency_ratio,
    female: female_map,
    male: male_map,
    sexRatio: sex_ratio,
    totalFemale: Math.round(total_female*10)/10,
    totalMale: Math.round(total_male*10)/10,
  }
}

/**
 * Computes sectoral employment shares (Agriculture, Informal, Manufacturing, Services, Not in Work) per country.
 *
 * @param {string[]} arg0_countries
 * @param {number} arg1_year
 * @param {boolean} [arg2_is_percentage=true]
 *
 * @returns {SectorBreakdownResult}
 */
export function getCountrySectorBreakdown (
  arg0_countries: string[],
  arg1_year: number,
  arg2_is_percentage = true
): SectorBreakdownResult {
  //Convert from parameters
  let countries = arg0_countries
  let is_pct = arg2_is_percentage
  let year = arg1_year

  //Declare local instance variables
  let by_country: Record<string, Record<string, number>> = {}
  let compute_single_country: (arg0_name: string) => Record<string, number>
  let get_country_hash: (arg0_str: string) => number
  let global_map: Record<string, number>

  get_country_hash = function (arg0_str: string): number {
    let hash = 0
    for (let x = 0; x < arg0_str.length; x++) {
      hash = ((hash << 5) - hash) + arg0_str.charCodeAt(x)
      hash |= 0
    }
    return Math.abs(hash)
  }

  //Function body
  compute_single_country = function (arg0_name: string): Record<string, number> {
    let clean = arg0_name.toLowerCase().trim()
    let h = get_country_hash(clean)
    let map: Record<string, number> = {}

    //Determine country economic structure
    let is_agrarian = HIGH_FERTILITY_COUNTRIES.has(clean)
    let is_developing = DEVELOPING_DIVIDEND_COUNTRIES.has(clean)
    let is_factory = TRANSITION_EMERGING_COUNTRIES.has(clean)
    let is_industrial = clean === 'germany' || clean === 'south korea' || clean === 'korea' || clean === 'czechia' || clean === 'poland' || clean === 'japan'
    let is_western = MATURE_WESTERN_COUNTRIES.has(clean) || SUPER_AGED_COUNTRIES.has(clean) || clean === 'singapore'

    if (year <= 1800) {
      map.agriculture = is_western ? 68.0 : 80.0
      map.informal_labour = is_western ? 8.0 : 12.0
      map.manufacturing = is_western ? 14.0 : 5.0
      map.services = is_western ? 10.0 : 3.0
    } else if (year <= 1950) {
      let t = (year - 1800)/150
      if (is_western || is_industrial) {
        map.agriculture = 68.0*(1 - t) + 14.0*t
        map.informal_labour = 8.0*(1 - t) + 6.0*t
        map.manufacturing = 14.0*(1 - t) + 40.0*t
        map.services = 10.0*(1 - t) + 40.0*t
      } else {
        map.agriculture = 80.0*(1 - t) + 62.0*t
        map.informal_labour = 12.0*(1 - t) + 18.0*t
        map.manufacturing = 5.0*(1 - t) + 11.0*t
        map.services = 3.0*(1 - t) + 9.0*t
      }
    } else {
      let t = Math.min(1, (year - 1950)/75)
      if (is_industrial) {
        map.agriculture = 14.0*(1 - t) + 1.6*t
        map.informal_labour = 6.0*(1 - t) + 3.8*t
        map.manufacturing = 40.0*(1 - t) + 26.5*t
        map.services = 40.0*(1 - t) + 68.1*t
      } else if (is_western) {
        map.agriculture = 14.0*(1 - t) + 2.0*t
        map.informal_labour = 6.0*(1 - t) + 4.8*t
        map.manufacturing = 40.0*(1 - t) + 14.2*t
        map.services = 40.0*(1 - t) + 79.0*t
      } else if (is_factory) {
        map.agriculture = 58.0*(1 - t) + 20.0*t
        map.informal_labour = 16.0*(1 - t) + 10.5*t
        map.manufacturing = 15.0*(1 - t) + 30.5*t
        map.services = 11.0*(1 - t) + 39.0*t
      } else if (is_developing) {
        map.agriculture = 65.0*(1 - t) + 38.0*t
        map.informal_labour = 19.0*(1 - t) + 26.0*t
        map.manufacturing = 10.0*(1 - t) + 15.0*t
        map.services = 6.0*(1 - t) + 21.0*t
      } else if (is_agrarian) {
        map.agriculture = 72.0*(1 - t) + 48.0*t
        map.informal_labour = 19.0*(1 - t) + 34.0*t
        map.manufacturing = 6.0*(1 - t) + 7.5*t
        map.services = 3.0*(1 - t) + 10.5*t
      } else {
        map.agriculture = 24.0*(1 - t) + 9.5*t
        map.informal_labour = 13.0*(1 - t) + 10.5*t
        map.manufacturing = 34.0*(1 - t) + 19.0*t
        map.services = 29.0*(1 - t) + 61.0*t
      }
    }

    //Apply deterministic country-specific profile variation so each country is unique
    if (clean !== 'global') {
      let v_agri = ((h % 41)/40 - 0.5)*3.2
      let v_inf = (((h >> 3) % 41)/40 - 0.5)*2.8
      let v_mfg = (((h >> 6) % 41)/40 - 0.5)*4.5
      let v_srv = (((h >> 9) % 41)/40 - 0.5)*4.5

      map.agriculture = Math.max(0.5, map.agriculture + v_agri)
      map.informal_labour = Math.max(0.5, map.informal_labour + v_inf)
      map.manufacturing = Math.max(0.5, map.manufacturing + v_mfg)
      map.services = Math.max(0.5, map.services + v_srv)
    }

    //Normalize to exactly 100.0% across the 4 active workforce sectors
    if (is_pct) {
      let sum = map.agriculture + map.informal_labour + map.manufacturing + map.services
      if (sum > 0) {
        map.agriculture = Math.round((map.agriculture/sum)*1000)/10
        map.informal_labour = Math.round((map.informal_labour/sum)*1000)/10
        map.manufacturing = Math.round((map.manufacturing/sum)*1000)/10
        //Assign remainder to services to guarantee exactly 100.0% sum
        map.services = Math.round((100 - (map.agriculture + map.informal_labour + map.manufacturing))*10)/10
      }
    }

    return map
  }

  //Compute global baseline
  global_map = compute_single_country('global')

  //Compute for each requested country
  for (let i = 0; i < countries.length; i++) {
    let c_name = countries[i].trim()
    if (c_name) {
      by_country[c_name] = compute_single_country(c_name)
    }
  }

  //Return statement
  return {
    byCountry: by_country,
    global: global_map,
  }
}
