import React from 'react'
import { cn } from '@/lib/utils'

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string
  size?: number | string
}

export const Icon: React.FC<IconProps> = ({ name, className, style, size, ...props }) => {
  const iconSize = size ? (typeof size === 'number' ? `${size}px` : size) : '1rem'
  return (
    <span
      className={cn(
        'material-icons text-white inline-flex items-center justify-center select-none shrink-0 leading-none align-middle font-normal',
        className
      )}
      style={{
        fontSize: iconSize,
        width: iconSize,
        height: iconSize,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  )
}

export default Icon
