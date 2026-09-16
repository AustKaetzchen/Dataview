import JSON5 from 'json5'
import rawEnGb from '@/../localisation/en_gb.json5?raw'
import rawFr from '@/../localisation/fr.json5?raw'
import rawDe from '@/../localisation/de.json5?raw'
import { LocalisationConfig } from '@common/localisation/localisation'

export type SupportedLocale = 'en-GB' | 'fr' | 'de'

let DICTIONARIES: Record<SupportedLocale, LocalisationConfig> = {
  'de': JSON5.parse(rawDe),
  'en-GB': JSON5.parse(rawEnGb),
  'fr': JSON5.parse(rawFr),
}

let current_locale: SupportedLocale = 'en-GB'

/**
 * Gets the current active locale identifier.
 *
 * @returns {SupportedLocale}
 */
export function getCurrentLocale (): SupportedLocale {
  //Return statement
  return current_locale
}

/**
 * Sets the active application locale.
 *
 * @param {SupportedLocale} arg0_locale
 *
 * @returns {void}
 */
export function setLocale (arg0_locale: SupportedLocale): void {
  //Convert from parameters
  let locale = arg0_locale

  //Guard clauses
  if (!DICTIONARIES[locale])
    return

  //Function body
  current_locale = locale
}

/**
 * Resolves localized strings dictionary for the current or specified locale.
 *
 * @param {SupportedLocale} [arg0_locale]
 *
 * @returns {LocalisationConfig}
 */
export function getLocalisation (arg0_locale?: SupportedLocale): LocalisationConfig {
  //Convert from parameters
  let target_locale = arg0_locale || current_locale

  //Return statement
  return DICTIONARIES[target_locale] || DICTIONARIES['en-GB']
}

/**
 * Interpolates variables formatted as £var_name£ or £1£ into a localized template string.
 *
 * @param {string} arg0_template
 * @param {Record<string, string | number> | Array<string | number>} arg1_params
 *
 * @returns {string}
 */
export function formatLocalisedString (
  arg0_template: string,
  arg1_params: Record<string, string | number> | Array<string | number>
): string {
  //Convert from parameters
  let params = arg1_params
  let template = arg0_template

  //Declare local instance variables
  let result = template

  //Guard clauses
  if (!template)
    return ''
  if (!params)
    return template

  //Function body
  if (Array.isArray(params)) {
    for (let i = 0; i < params.length; i++) {
      let placeholder = `£${i + 1}£`
      let val = String(params[i])
      result = result.split(placeholder).join(val)
    }
  } else {
    let all_keys = Object.keys(params)
    for (let i = 0; i < all_keys.length; i++) {
      let key = all_keys[i]
      let placeholder = `£${key}£`
      let val = String(params[key])
      result = result.split(placeholder).join(val)
    }
  }

  //Return statement
  return result
}
