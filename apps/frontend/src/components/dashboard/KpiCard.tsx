/**
 * components/dashboard/KpiCard.tsx — Premium animated KPI metric card
 * IAD SmartVision Dashboard — Blue/Cyan enterprise theme
 *
 * Security: No dangerouslySetInnerHTML. All values rendered via React JSX.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiTrend = 'up' | 'down' | 'neutral';
export type KpiColor = 'primary' | 'success' | 'warning' | 'danger' | 'cyan' | 'purple' | 'muted';

interface KpiCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: KpiTrend;
  trendLabel?: string;
  icon: React.ElementType;
  color?: KpiColor;
  animate?: boolean;
  delay?: number;
  className?: string;
  subtitle?: string;
}

const colorMap: Record<KpiColor, { icon: string; bg: string; ring: string; glow: string }> = {
  primary: {
    icon: 'text-blue-400',
    bg: 'bg-blue-500/10',
    ring: 'ring-blue-500/20',
    glow: 'group-hover:shadow-blue-500/15',
  },
  cyan: {
    icon: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    ring: 'ring-cyan-500/20',
    glow: 'group-hover:shadow-cyan-500/15',
  },
  success: {
    icon: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    ring: 'ring-emerald-500/20',
    glow: 'group-hover:shadow-emerald-500/15',
  },
  warning: {
    icon: 'text-amber-400',
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/20',
    glow: 'group-hover:shadow-amber-500/15',
  },
  danger: {
    icon: 'text-red-400',
    bg: 'bg-red-500/10',
    ring: 'ring-red-500/20',
    glow: 'group-hover:shadow-red-500/15',
  },
  purple: {
    icon: 'text-purple-400',
    bg: 'bg-purple-500/10',
    ring: 'ring-purple-500/20',
    glow: 'group-hover:shadow-purple-500/15',
  },
  muted: {
    icon: 'text-slate-400',
    bg: 'bg-slate-500/10',
    ring: 'ring-slate-500/20',
    glow: 'group-hover:shadow-slate-500/10',
  },
};

const trendConfig: Record<KpiTrend, { icon: React.ElementType; color: string }> = {
  up: { icon: TrendingUp, color: 'text-emerald-400' },
  down: { icon: TrendingDown, color: 'text-red-400' },
  neutral: { icon: Minus, color: 'text-slate-500' },
};

export const KpiCard = React.memo(function KpiCard({
  title,
  value,
  unit,
  trend = 'neutral',
  trendLabel,
  icon: Icon,
  color = 'primary',
  animate = true,
  delay = 0,
  className,
  subtitle,
}: KpiCardProps) {
  const colors = colorMap[color];
  const trendCfg = trendConfig[trend];
  const TrendIcon = trendCfg.icon;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        'glass-card p-5 flex flex-col gap-4 relative overflow-hidden group cursor-default',
        'transition-shadow duration-300',
        colors.glow,
        className,
      )}
      aria-label={`${title}: ${value}${unit ? ' ' + unit : ''}`}
    >
      {/* Gradient top accent line */}
      <div className={cn('absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300', colors.bg.replace('/10', ''))} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </p>
        <div className={cn('flex items-center justify-center w-9 h-9 rounded-xl ring-1', colors.bg, colors.ring)}>
          <Icon className={cn('h-4.5 w-4.5', colors.icon)} aria-hidden="true" />
        </div>
      </div>

      {/* Value */}
      <div className="space-y-0.5">
        <motion.div
          key={String(value)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-baseline gap-1.5"
        >
          <span className="text-[2rem] font-extrabold tracking-tight leading-none text-foreground">
            {value}
          </span>
          {unit && (
            <span className="text-sm font-medium text-muted-foreground">{unit}</span>
          )}
        </motion.div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Trend */}
      {trendLabel && (
        <div className={cn('flex items-center gap-1.5 text-xs font-medium', trendCfg.color)}>
          <TrendIcon className="h-3 w-3" aria-hidden="true" />
          <span>{trendLabel}</span>
        </div>
      )}
    </motion.div>
  );
});
