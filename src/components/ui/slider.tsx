import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

/**
 * Interactive range slider primitive component.
 *
 * @param {React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>} arg0_props
 * @param {React.ForwardedRef<React.ElementRef<typeof SliderPrimitive.Root>>} arg1_ref
 *
 * @returns {React.ReactElement}
 */
export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let { className, ...props } = arg0_props;
  let ref = arg1_ref;

  //Return statement
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        'relative flex w-full touch-none select-none items-center',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-none bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-none border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing" />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;
