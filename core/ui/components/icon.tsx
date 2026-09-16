import React from 'react';
import { cn } from '@framework/utils/utils.ts';

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: number | string;
}

/**
 * Renders a Google Material Icons glyph with normalised styling and dimensions.
 *
 * @param {IconProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export function Icon (arg0_props: IconProps) {
  //Convert from parameters
  let { name, className, style, size, ...props } = arg0_props;

  //Declare local instance variables
  let icon_size = size ? (typeof size === 'number' ? `${size}px` : size) : '1rem';

  //Return statement
  return (
    <span
      className={cn(
        'material-icons text-white inline-flex items-center justify-center select-none shrink-0 leading-none align-middle font-normal',
        className
      )}
      style={{
        fontSize: icon_size,
        width: icon_size,
        height: icon_size,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  );
}

export default Icon;
