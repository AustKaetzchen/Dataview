import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@framework/utils/utils.ts';

export let badgeVariants = cva(
  'inline-flex items-center rounded-none border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-sky-500/20 text-sky-300 border-sky-500/30',
        secondary: 'border-transparent bg-slate-800 text-slate-300 border-slate-700',
        destructive: 'border-transparent bg-red-500/20 text-red-300 border-red-500/30',
        outline: 'text-slate-300 border-slate-700',
        emerald: 'border-transparent bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        amber: 'border-transparent bg-amber-500/20 text-amber-300 border-amber-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Renders a small badge tag with semantic colour styles.
 *
 * @param {BadgeProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export function Badge (arg0_props: BadgeProps) {
  //Convert from parameters
  let { className, variant, ...props } = arg0_props;

  //Return statement
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
