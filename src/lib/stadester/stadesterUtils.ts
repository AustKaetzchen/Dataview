import { StadesterDisplayOptions } from '@/lib/geopng/types'

/**
 * Counts the number of diacritical combining marks in a given string.
 *
 * @param {string} arg0_str
 *
 * @returns {number}
 */
export const countDiacritics = function (arg0_str: string): number {
  //Convert from parameters
  let str = arg0_str

  //Declare local instance variables
  let diacritics: RegExpMatchArray | null
  let normalized: string

  //Guard clauses
  if (!str)
    return 0

  //Function body
  normalized = str.normalize('NFD')
  diacritics = normalized.match(/[\u0300-\u036f]/g)

  //Return statement
  return diacritics ? diacritics.length : 0
}

/**
 * Picks the optimal candidate city display name based on dataset display options.
 * Disqualifies unknown unicode characters (\uFFFD), removes parenthetical notes,
 * and prioritises candidates with the lowest diacritic count.
 *
 * @param {string} arg0_name
 * @param {string | string[]} [arg1_other_names]
 * @param {StadesterDisplayOptions} [arg2_options]
 *
 * @returns {string}
 */
export const pickBestCityDisplayName = function (
  arg0_name: string,
  arg1_other_names?: string | string[],
  arg2_options?: StadesterDisplayOptions
): string {
  //Convert from parameters
  let name = arg0_name
  let options = (arg2_options) ? arg2_options : {}
  let other_names = arg1_other_names

  //Declare local instance variables
  let candidates: string[] = []
  let clean_candidates: string[]
  let prefer_least_diacritics = options.prefer_least_diacritics !== false
  let raw_candidates: string[] = []
  let skip_unknown_unicode = options.skip_unknown_unicode !== false
  let strip_parentheses = options.strip_parentheses !== false

  //Guard clauses
  if (!name)
    return ''

  //Function body
  //1. Extract all semicolon-delimited names from primary name string
  raw_candidates = name.split(';')

  //2. Append any alternative names
  if (Array.isArray(other_names)) {
    for (let i = 0; i < other_names.length; i++) {
      if (other_names[i])
        raw_candidates.push(...String(other_names[i]).split(';'))
    }
  } else if (typeof other_names === 'string' && other_names.trim()) {
    raw_candidates.push(...other_names.split(';'))
  }

  //3. Clean candidate strings and strip round bracket notes if enabled
  for (let i = 0; i < raw_candidates.length; i++) {
    let candidate = raw_candidates[i].trim()
    if (!candidate)
      continue

    if (strip_parentheses) {
      //Remove everything inside round brackets e.g. "Kabul (agglomeration)" -> "Kabul"
      candidate = candidate.replace(/\s*\([^)]*\)/g, '').trim()
    }

    if (candidate)
      candidates.push(candidate)
  }

  if (candidates.length === 0)
    return strip_parentheses ? name.replace(/\s*\([^)]*\)/g, '').trim() : name

  //4. Filter out candidates with corrupt or unknown unicode characters
  if (skip_unknown_unicode) {
    clean_candidates = candidates.filter((arg0_c) => {
      return !arg0_c.includes('\uFFFD') && !arg0_c.includes('\u00EF\u00BF\u00BD') && !arg0_c.includes('')
    })
    if (clean_candidates.length > 0)
      candidates = clean_candidates
  }

  //5. Select candidate with fewest diacritics if enabled
  if (prefer_least_diacritics && candidates.length > 1) {
    candidates.sort((arg0_a, arg0_b) => {
      let count_a = countDiacritics(arg0_a)
      let count_b = countDiacritics(arg0_b)
      if (count_a !== count_b)
        return count_a - count_b
      return arg0_a.length - arg0_b.length
    })
  }

  //Return statement
  return candidates[0]
}
