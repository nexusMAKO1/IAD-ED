/**
 * components/dashboard/KpiCard.tsx — Animated KPI metric card
 * SmartVision IAD Dashboard
 *
 * Security: No dangerouslySetInnerHTML. All values rendered via React JSX auto-escaping.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiTrend = 'up' | 'down' | 'neutral';
export type KpiColor = 'primary' | 'success' | 'warning' | 'danger' | 'muted';

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

const colorMap: Record<KpiColor, { icon: string; bg: string; badge: string }> = {
  primary: {
    icon: 'text-violet-400',
    bg: 'bg-violet-500/10',
    badge: 'text-violet-400',
  },
  success: {
    icon: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    badge: 'text-emerald-400',
  },
  warning: {
    icon: 'text-amber-400',
    bg: 'bg-amber-500/10',
    badge: 'text-amber-400',
  },
  danger: {
    icon: 'text-red-400',
    bg: 'bg-red-500/10',
    badge: 'text-red-400',
  },
  muted: {
    icon: 'text-slate-400',
    bg: 'bg-slate-500/10',
    badge: 'text-slate-400',
  },
};

const trendConfig: Record<KpiTrend, { icon: React.ElementType; color: string }> = {
  up: { icon: TrendingUp, color: 'text-emerald-400' },
  down: { icon: TrendingDown, color: 'text-red-400' },
  neutral: { icon: Minus, color: 'text-slate-400' },
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
      initial={animate ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={cn(
        'glass-card p-5 flex flex-col gap-3 relative overflow-hidden group',
        className,
      )}
      aria-label={`${title}: ${value}${unit ? ' ' + unit : ''}`}
    >
      {/* Subtle background glow */}
      <div
        className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
          colors.bg,
        )}
        aria-hidden="true"
      />

      {/* Header row */}
      <div className="flex items-center justify-between relative z-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg', colors.bg)}>
          <Icon className={cn('h-4 w-4', colors.icon)} aria-hidden="true" />
        </div>
      </div>

      {/* Value */}
      <motion.div
        key={String(value)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {value}
          </span>
          {unit && (
            <span className="text-sm font-medium text-muted-foreground">{unit}</span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </motion.div>

      {/* Trend */}
      {trendLabel && (
        <div className={cn('flex items-center gap-1.5 text-xs font-medium relative z-10', trendCfg.color)}>
          <TrendIcon className="h-3 w-3" aria-hidden="true" />
          <span>{trendLabel}</span>
        </div>
      )}
    </motion.div>
  );
});
