/**
 * Shared utility functions for Deck.gl smooth map, globe, and orbit controllers.
 */

/**
 * Checks whether the modifier function key (Ctrl or Meta) is pressed on an input event.
 *
 * @param {any} arg0_event
 *
 * @returns {boolean}
 */
export function isFunctionKeyPressed (arg0_event: any): boolean {
  //Convert from parameters
  let event = arg0_event

  //Declare local instance variables
  let src = event?.srcEvent

  //Return statement
  return Boolean(src?.ctrlKey || src?.metaKey)
}
