import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines class names with Tailwind merge.
 *
 * @param {...ClassValue[]} arg0_inputs
 *
 * @returns {string}
 */
export function cn (...arg0_inputs: ClassValue[]): string {
  //Convert from parameters
  let inputs = arg0_inputs

  //Return statement
  return twMerge(clsx(inputs))
}

/**
 * Formats a localized number to fixed decimal places with European decimal notation, falling back to 'N/A' if undefined.
 *
 * @param {number | undefined | null} arg0_val
 * @param {number} [arg1_fraction_digits=4]
 *
 * @returns {string}
 */
export function formatLocalizedNumber (
  arg0_val: number | undefined | null,
  arg1_fraction_digits?: number
): string {
  //Convert from parameters
  let fraction_digits = (arg1_fraction_digits !== undefined) ? arg1_fraction_digits : 4
  let val = arg0_val

  //Guard clauses
  if (val === undefined || val === null || !Number.isFinite(val))
    return 'N/A'

  //Return statement
  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: fraction_digits,
    minimumFractionDigits: fraction_digits,
  }).format(val)
}

/**
 * Formats a number based off of European decimal notation (de-DE), rounding it to the specified number of places.
 *
 * @param {number | string | null | undefined} arg0_number
 * @param {number} [arg1_places=0]
 *
 * @returns {string}
 */
export function formatNumber (
  arg0_number: number | string | null | undefined,
  arg1_places?: number
): string {
  //Convert from parameters
  let number = parseFloat(arg0_number as any)
  let places = (arg1_places !== undefined) ? arg1_places : 0

  //Guard clauses
  if (arg0_number === undefined || arg0_number === null || Number.isNaN(number))
    return 'N/A'

  //Return statement
  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: places,
    minimumFractionDigits: places,
  }).format(number)
}
