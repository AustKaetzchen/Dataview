import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

/**
 * Boolean toggle switch primitive component.
 *
 * @param {React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>} arg0_props
 * @param {React.ForwardedRef<React.ElementRef<typeof SwitchPrimitives.Root>>} arg1_ref
 *
 * @returns {React.ReactElement}
 */
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let { className, ...props } = arg0_props;
  let ref = arg1_ref;

  //Return statement
  return (
    <SwitchPrimitives.Root
      className={cn(
        'peer inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-none border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-sky-500 data-[state=unchecked]:bg-slate-700',
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none block h-3 w-3 rounded-none bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0'
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;
