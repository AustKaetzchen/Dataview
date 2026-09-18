import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import {
  LocalisationConfig,
  LOCALISATION_DICTIONARIES,
  SupportedLocale,
  formatLocalisedString,
  updateLocalisationDictionary,
} from './dictionaries'
import { onConfigUpdate } from '@framework/config/config_hot_reload'

export interface LocalisationContextValue {
  format: (arg0_template: string, arg1_params?: Record<string, string | number> | Array<string | number> | string | number, ...arg2_rest: Array<string | number>) => string
  formatString: (arg0_template: string, ...arg1_args: any[]) => string
  locale: SupportedLocale
  setLocale: (arg0_locale: SupportedLocale) => void
  t: LocalisationConfig
}

let default_context_value: LocalisationContextValue = {
  format: formatLocalisedString,
  formatString: formatLocalisedString,
  locale: 'en-GB',
  setLocale: () => {},
  t: LOCALISATION_DICTIONARIES['en-GB'],
}

let LocalisationContext = createContext<LocalisationContextValue>(default_context_value)

/**
 * Resolves the initial locale based on saved user preference or browser navigator settings.
 *
 * @returns {SupportedLocale}
 */
export function getInitialLocale (): SupportedLocale {
  //Declare local instance variables
  let browser_lang: string
  let saved: string | null

  //Guard clauses
  if (typeof window === 'undefined')
    return 'en-GB'

  //Function body
  saved = localStorage.getItem('dataview_locale')
  if (saved && (saved === 'en-GB' || saved === 'fr' || saved === 'de'))
    return saved as SupportedLocale

  browser_lang = (navigator.language || '').toLowerCase()
  if (browser_lang.startsWith('fr'))
    return 'fr'
  if (browser_lang.startsWith('de'))
    return 'de'

  //Return statement
  return 'en-GB'
}

/**
 * LocalisationProvider supplies reactive multi-language translation dictionaries across the application.
 *
 * @param {{ children: React.ReactNode }} arg0_props
 *
 * @returns {React.ReactElement}
 */
export function LocalisationProvider (arg0_props: { children: React.ReactNode }): React.ReactElement {
  //Convert from parameters
  let props = arg0_props

  //Declare local instance variables
  let [current_locale, set_current_locale] = useState<SupportedLocale>(getInitialLocale)
  let [version, set_version] = useState<number>(0)
  let active_dictionary: LocalisationConfig
  let context_value: LocalisationContextValue
  let handle_set_locale: (arg0_next_locale: SupportedLocale) => void

  //Function body
  useEffect(() => {
    let unsubscribe = onConfigUpdate('localisation', (arg0_payload: any) => {
      //Convert from parameters
      let payload = arg0_payload

      //Guard clauses
      if (!payload)
        return

      //Function body
      let dictionary = payload.dictionary || payload.data || (payload.app ? payload : null)
      let locale = (payload.locale as SupportedLocale) || 'en-GB'

      if (dictionary) {
        updateLocalisationDictionary(locale, dictionary)
        set_version((arg0_v) => arg0_v + 1)
      }
    })

    //Return statement
    return () => {
      unsubscribe()
    }
  }, [])

  handle_set_locale = useCallback(function (arg0_next_locale: SupportedLocale) {
    //Convert from parameters
    let next_locale = arg0_next_locale

    //Function body
    set_current_locale(next_locale)
    if (typeof localStorage !== 'undefined')
      localStorage.setItem('dataview_locale', next_locale)
  }, [])

  active_dictionary = useMemo(() => {
    return LOCALISATION_DICTIONARIES[current_locale] || LOCALISATION_DICTIONARIES['en-GB']
  }, [current_locale, version])

  context_value = useMemo(() => {
    return {
      format: formatLocalisedString,
      formatString: formatLocalisedString,
      locale: current_locale,
      setLocale: handle_set_locale,
      t: active_dictionary,
    }
  }, [active_dictionary, current_locale, handle_set_locale])

  //Return statement
  return (
    <LocalisationContext.Provider value={context_value}>
      {props.children}
    </LocalisationContext.Provider>
  )
}

/**
 * React hook returning active translation dictionary and locale changer.
 *
 * @returns {LocalisationContextValue}
 */
export function useLocalisation (): LocalisationContextValue {
  //Return statement
  return useContext(LocalisationContext)
}
