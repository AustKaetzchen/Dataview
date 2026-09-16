import * as React from 'react';
import { cn } from '@framework/utils/utils.ts';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Styled text / numeric input element.
 *
 * @param {InputProps} arg0_props
 * @param {React.ForwardedRef<HTMLInputElement>} arg1_ref
 *
 * @returns {React.ReactElement}
 */
export let Input = React.forwardRef<HTMLInputElement, InputProps>(
  function (arg0_props, arg1_ref) {
    //Convert from parameters
    let { className, type, ...props } = arg0_props;
    let ref = arg1_ref;

    //Return statement
    return (
      <input
        type={type}
        className={cn(
          'flex h-8 w-full rounded-none border border-input bg-background px-2.5 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
