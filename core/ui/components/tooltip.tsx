import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@framework/utils/utils.ts';

export let TooltipProvider = TooltipPrimitive.Provider;
export let Tooltip = TooltipPrimitive.Root;
export let TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * Tooltip content container component.
 *
 * @param {React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>} arg0_props
 * @param {React.ForwardedRef<React.ElementRef<typeof TooltipPrimitive.Content>>} arg1_ref
 *
 * @returns {React.ReactElement}
 */
export let TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let { className, sideOffset = 6, ...props } = arg0_props;
  let ref = arg1_ref;

  //Return statement
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 overflow-hidden rounded-none border border-border bg-popover/95 px-2.5 py-1 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 select-none pointer-events-none font-sans',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
