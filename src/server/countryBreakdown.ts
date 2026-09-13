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

//Demographic cohort IDs
let AGE_IDS = [
  '00', '01', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60', '65', '70', '75', '80'
]

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
  let working_count = 0
  let youth_dep_count = 0

  //Determine country archetype
  let is_high_fertility = HIGH_FERTILITY_COUNTRIES.has(clean_name)
  let is_mature = MATURE_WESTERN_COUNTRIES.has(clean_name)
  let is_super_aged = SUPER_AGED_COUNTRIES.has(clean_name)
  let is_transition = TRANSITION_EMERGING_COUNTRIES.has(clean_name)

  //Function body
  for (let i = 0; i < AGE_IDS.length; i++) {
    let age_factor = 1.0
    let cid = AGE_IDS[i]
    let f_val: number
    let female_bias = 0.98 + i*0.008 //Women outlive men in older cohorts
    let m_val: number
    let male_bias = 1.02 - i*0.006

    if (year <= 1850) {
      //Pre-industrial classical pyramid across all countries (high birth & high mortality)
      age_factor = Math.exp(-i*0.14)
    } else if (is_super_aged) {
      if (year >= 2000) {
        //Contracting inverted urn pyramid: very low youth, peak around 50-65
        let t_recent = Math.min(1, (year - 2000)/25)
        if (i <= 3) {
          age_factor = (0.45 - i*0.03)*(1 - t_recent*0.2)
        } else if (i >= 9 && i <= 14) {
          age_factor = 1.15 + (i - 9)*0.03
        } else if (i >= 15) {
          age_factor = 0.85 - (i - 15)*0.18
        } else {
          age_factor = 0.65 + i*0.05
        }
      } else {
        let t_mid = (year - 1850)/150
        age_factor = Math.exp(-i*(0.14 - t_mid*0.06))
      }
    } else if (is_mature) {
      if (year >= 1970) {
        //Stationary/pillar shape with post-war baby boom cohorts and stable youth
        if (i <= 3) {
          age_factor = 0.72 - i*0.02
        } else if (i >= 4 && i <= 12) {
          age_factor = 0.92 + (i === 8 || i === 9 ? 0.15 : 0)
        } else {
          age_factor = 0.75 - (i - 12)*0.14
        }
      } else {
        let t_mid = (year - 1850)/120
        age_factor = Math.exp(-i*(0.14 - t_mid*0.05))
      }
    } else if (is_transition) {
      if (year >= 2000) {
        //Rapid demographic transition: broad 25-45, narrowing base
        if (i <= 3) {
          age_factor = 0.58 - i*0.03
        } else if (i >= 4 && i <= 10) {
          age_factor = 1.08 + (i === 6 ? 0.14 : 0)
        } else {
          age_factor = 0.65 - (i - 10)*0.13
        }
      } else {
        let t_mid = Math.max(0, (year - 1850)/150)
        age_factor = Math.exp(-i*(0.14 - t_mid*0.04))
      }
    } else if (is_high_fertility) {
      //Expansive triangular pyramid: extremely wide youth base, rapid tapering
      let taper_rate = year >= 1980 ? 0.11 : 0.13
      age_factor = Math.exp(-i*taper_rate)
    } else {
      //Default / developing demographic dividend
      if (year >= 2000) {
        if (i <= 3) {
          age_factor = 0.88 - i*0.04
        } else if (i >= 4 && i <= 9) {
          age_factor = 0.98 + (i === 5 ? 0.1 : 0)
        } else {
          age_factor = 0.68 - (i - 9)*0.11
        }
      } else {
        let t_mid = Math.max(0, (year - 1850)/150)
        age_factor = Math.exp(-i*(0.14 - t_mid*0.045))
      }
    }

    m_val = Math.max(0.1, base_scale*age_factor*male_bias)
    f_val = Math.max(0.1, base_scale*age_factor*female_bias)

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

  sex_ratio = total_female > 0 ? Math.round((total_male/total_female)*1000)/1000 : 1.0
  dependency_ratio = working_count > 0 ? Math.round(((youth_dep_count + old_dep_count)/working_count)*1000)/10 : 50.0

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
  let global_map: Record<string, number>

  //Function body
  compute_single_country = function (arg0_name: string): Record<string, number> {
    let clean = arg0_name.toLowerCase().trim()
    let map: Record<string, number> = {}

    //Determine country economic structure
    let is_agrarian = HIGH_FERTILITY_COUNTRIES.has(clean)
    let is_developing = DEVELOPING_DIVIDEND_COUNTRIES.has(clean)
    let is_factory = TRANSITION_EMERGING_COUNTRIES.has(clean)
    let is_industrial = clean === 'germany' || clean === 'south korea' || clean === 'czechia' || clean === 'poland'
    let is_western = MATURE_WESTERN_COUNTRIES.has(clean) || clean === 'japan'

    if (year <= 1800) {
      map.agriculture = is_western ? 65.0 : 78.0
      map.informal_labour = is_western ? 8.0 : 10.0
      map.manufacturing = is_western ? 12.0 : 5.0
      map.not_in_work = 5.0
      map.services = is_western ? 10.0 : 2.0
    } else if (year <= 1950) {
      let t = (year - 1800)/150
      if (is_western || is_industrial) {
        map.agriculture = 65.0*(1 - t) + 12.0*t
        map.informal_labour = 8.0*(1 - t) + 5.0*t
        map.manufacturing = 12.0*(1 - t) + 38.0*t
        map.not_in_work = 5.0*(1 - t) + 6.0*t
        map.services = 10.0*(1 - t) + 39.0*t
      } else {
        map.agriculture = 78.0*(1 - t) + 60.0*t
        map.informal_labour = 10.0*(1 - t) + 16.0*t
        map.manufacturing = 5.0*(1 - t) + 11.0*t
        map.not_in_work = 5.0*(1 - t) + 5.0*t
        map.services = 2.0*(1 - t) + 8.0*t
      }
    } else {
      let t = Math.min(1, (year - 1950)/75)
      if (is_western) {
        map.agriculture = 12.0*(1 - t) + 1.8*t
        map.informal_labour = 5.0*(1 - t) + 4.2*t
        map.manufacturing = 38.0*(1 - t) + 12.5*t
        map.not_in_work = 6.0*(1 - t) + 5.5*t
        map.services = 39.0*(1 - t) + 76.0*t
      } else if (is_industrial) {
        map.agriculture = 12.0*(1 - t) + 1.5*t
        map.informal_labour = 5.0*(1 - t) + 3.5*t
        map.manufacturing = 38.0*(1 - t) + 24.5*t
        map.not_in_work = 6.0*(1 - t) + 5.5*t
        map.services = 39.0*(1 - t) + 65.0*t
      } else if (is_factory) {
        map.agriculture = 55.0*(1 - t) + 18.5*t
        map.informal_labour = 15.0*(1 - t) + 9.5*t
        map.manufacturing = 14.0*(1 - t) + 28.5*t
        map.not_in_work = 5.0*(1 - t) + 6.0*t
        map.services = 11.0*(1 - t) + 37.5*t
      } else if (is_developing) {
        map.agriculture = 62.0*(1 - t) + 36.0*t
        map.informal_labour = 18.0*(1 - t) + 24.5*t
        map.manufacturing = 10.0*(1 - t) + 14.5*t
        map.not_in_work = 5.0*(1 - t) + 5.0*t
        map.services = 5.0*(1 - t) + 20.0*t
      } else if (is_agrarian) {
        map.agriculture = 70.0*(1 - t) + 46.0*t
        map.informal_labour = 18.0*(1 - t) + 32.0*t
        map.manufacturing = 6.0*(1 - t) + 7.5*t
        map.not_in_work = 4.0*(1 - t) + 4.5*t
        map.services = 2.0*(1 - t) + 10.0*t
      } else {
        map.agriculture = 22.0*(1 - t) + 8.5*t
        map.informal_labour = 12.5*(1 - t) + 9.5*t
        map.manufacturing = 32.5*(1 - t) + 18.0*t
        map.not_in_work = 7.0*(1 - t) + 6.0*t
        map.services = 26.0*(1 - t) + 58.0*t
      }
    }

    //Normalize to exactly 100% in percentage mode
    if (is_pct) {
      let sum = map.agriculture + map.informal_labour + map.manufacturing + map.not_in_work + map.services
      if (sum > 0) {
        map.agriculture = Math.round((map.agriculture/sum)*1000)/10
        map.informal_labour = Math.round((map.informal_labour/sum)*1000)/10
        map.manufacturing = Math.round((map.manufacturing/sum)*1000)/10
        map.services = Math.round((map.services/sum)*1000)/10
        //Assign remainder to not_in_work to guarantee exactly 100.0% sum
        map.not_in_work = Math.round((100 - (map.agriculture + map.informal_labour + map.manufacturing + map.services))*10)/10
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
