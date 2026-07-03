import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
        // Device type badges
        totem:
          'border-violet-500/30 bg-violet-500/15 text-violet-300',
        screen:
          'border-blue-500/30 bg-blue-500/15 text-blue-300',
        kiosk:
          'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
        camera:
          'border-orange-500/30 bg-orange-500/15 text-orange-300',
        // Device status badges
        online:
          'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
        offline:
          'border-slate-500/30 bg-slate-500/15 text-slate-400',
        degraded:
          'border-amber-500/30 bg-amber-500/15 text-amber-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
