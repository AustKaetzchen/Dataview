import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@framework/utils/utils.ts';

export let Tabs = TabsPrimitive.Root;

/**
 * Tab list container component.
 *
 * @param {React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>} arg0_props
 * @param {React.ForwardedRef<React.ElementRef<typeof TabsPrimitive.List>>} arg1_ref
 *
 * @returns {React.ReactElement}
 */
export let TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let { className, ...props } = arg0_props;
  let ref = arg1_ref;

  //Return statement
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-none bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

/**
 * Tab switch trigger button component.
 *
 * @param {React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>} arg0_props
 * @param {React.ForwardedRef<React.ElementRef<typeof TabsPrimitive.Trigger>>} arg1_ref
 *
 * @returns {React.ReactElement}
 */
export let TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let { className, ...props } = arg0_props;
  let ref = arg1_ref;

  //Return statement
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-none px-2.5 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer',
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/**
 * Tab panel content component.
 *
 * @param {React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>} arg0_props
 * @param {React.ForwardedRef<React.ElementRef<typeof TabsPrimitive.Content>>} arg1_ref
 *
 * @returns {React.ReactElement}
 */
export let TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function (arg0_props, arg1_ref) {
  //Convert from parameters
  let { className, ...props } = arg0_props;
  let ref = arg1_ref;

  //Return statement
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      {...props}
    />
  );
});
TabsContent.displayName = TabsPrimitive.Content.displayName;
