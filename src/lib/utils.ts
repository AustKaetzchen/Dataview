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
