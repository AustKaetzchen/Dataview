import * as React from 'react';
import { cn } from '@framework/utils/utils.ts';

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Visual divider separator component.
 *
 * @param {SeparatorProps} arg0_props
 * @param {React.ForwardedRef<HTMLDivElement>} arg1_ref
 *
 * @returns {React.ReactElement}
 */
export let Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  function (arg0_props, arg1_ref) {
    //Convert from parameters
    let { className, orientation = 'horizontal', ...props } = arg0_props;
    let ref = arg1_ref;

    //Return statement
    return (
      <div
        ref={ref}
        className={cn(
          'shrink-0 bg-border',
          orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
          className
        )}
        {...props}
      />
    );
  }
);
Separator.displayName = 'Separator';
