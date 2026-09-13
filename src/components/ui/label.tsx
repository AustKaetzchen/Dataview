import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Accessible form label component.
 *
 * @param {React.LabelHTMLAttributes<HTMLLabelElement>} arg0_props
 * @param {React.ForwardedRef<HTMLLabelElement>} arg1_ref
 *
 * @returns {React.ReactElement}
 */
export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let { className, ...props } = arg0_props;
  let ref = arg1_ref;

  //Return statement
  return (
    <label
      ref={ref}
      className={cn(
        'text-xs font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  );
});
Label.displayName = 'Label';
