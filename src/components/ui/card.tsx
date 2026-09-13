import * as React from 'react'
import { cn } from '@/lib/utils'

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let props = arg0_props
  let ref = arg1_ref
  let { className, ...rest_props } = props

  //Return statement
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-none border border-border bg-card text-card-foreground shadow-sm',
        className
      )}
      {...rest_props}
    />
  )
})
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let props = arg0_props
  let ref = arg1_ref
  let { className, ...rest_props } = props

  //Return statement
  return (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-4', className)}
      {...rest_props}
    />
  )
})
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let props = arg0_props
  let ref = arg1_ref
  let { className, ...rest_props } = props

  //Return statement
  return (
    <h3
      ref={ref}
      className={cn('font-semibold text-sm leading-none tracking-tight', className)}
      {...rest_props}
    />
  )
})
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let props = arg0_props
  let ref = arg1_ref
  let { className, ...rest_props } = props

  //Return statement
  return (
    <p
      ref={ref}
      className={cn('text-xs text-muted-foreground', className)}
      {...rest_props}
    />
  )
})
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let props = arg0_props
  let ref = arg1_ref
  let { className, ...rest_props } = props

  //Return statement
  return <div ref={ref} className={cn('p-4 pt-0', className)} {...rest_props} />
})
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let props = arg0_props
  let ref = arg1_ref
  let { className, ...rest_props } = props

  //Return statement
  return (
    <div
      ref={ref}
      className={cn('flex items-center p-4 pt-0', className)}
      {...rest_props}
    />
  )
})
CardFooter.displayName = 'CardFooter'
