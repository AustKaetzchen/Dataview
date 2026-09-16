import React, { useState, useRef } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export interface MapmodeTooltipProps {
  children: React.ReactElement
  name: string
  unit?: string
}

/**
 * Renders a left-extending single-line tooltip showing the mapmode name and its unit in full, disabled for touch actions.
 *
 * @param {MapmodeTooltipProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export const MapmodeTooltip: React.FC<MapmodeTooltipProps> = function (arg0_props) {
  //Convert from parameters
  let children = arg0_props.children
  let name = arg0_props.name
  let unit = arg0_props.unit

  //Declare local instance variables
  let clean_unit: string | null
  let formatted_unit_str: string
  let handle_focus: (arg0_e: React.FocusEvent) => void
  let handle_mouse_enter: () => void
  let handle_open_change: (arg0_open: boolean) => void
  let handle_pointer_down: (arg0_e: React.PointerEvent) => void
  let handle_touch_start: () => void
  let is_open: boolean
  let is_touch_ref = useRef<boolean>(false)
  let set_is_open: React.Dispatch<React.SetStateAction<boolean>>

  //Function body
  ;[is_open, set_is_open] = useState<boolean>(false)

  clean_unit = (unit && unit.trim().length > 0) ? unit.trim() : null
  formatted_unit_str = ''
  if (clean_unit)
    formatted_unit_str = (clean_unit.startsWith('(') && clean_unit.endsWith(')'))
      ? clean_unit
      : `(${clean_unit})`

  handle_focus = function (arg0_e: React.FocusEvent) {
    arg0_e.preventDefault()
  }

  handle_mouse_enter = function () {
    is_touch_ref.current = false
  }

  handle_open_change = function (arg0_open: boolean) {
    let open_state = arg0_open
    if (is_touch_ref.current && open_state) {
      set_is_open(false)
      return
    }
    set_is_open(open_state)
  }

  handle_pointer_down = function (arg0_e: React.PointerEvent) {
    let pointer_event = arg0_e
    if (pointer_event.pointerType === 'touch') {
      is_touch_ref.current = true
      set_is_open(false)
    }
  }

  handle_touch_start = function () {
    is_touch_ref.current = true
    set_is_open(false)
  }


  //Return statement
  return (
    <Tooltip open={is_open} onOpenChange={handle_open_change}>
      <TooltipTrigger
        asChild
        onFocus={handle_focus}
        onMouseEnter={handle_mouse_enter}
        onPointerDown={handle_pointer_down}
        onTouchStart={handle_touch_start}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        side="left"
        sideOffset={8}
        className="whitespace-nowrap max-w-none z-50 text-xs px-2.5 py-1 bg-popover/95 border border-border shadow-lg select-none pointer-events-none hidden [@media(hover:hover)]:block"
      >
        <span className="font-medium text-foreground">{name}</span>
        {formatted_unit_str ? (
          <span className="text-muted-foreground font-mono ml-1.5">{formatted_unit_str}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}

export default MapmodeTooltip
