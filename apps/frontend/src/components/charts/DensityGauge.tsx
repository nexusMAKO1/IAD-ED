/**
 * components/charts/DensityGauge.tsx — Crowd density radial gauge
 * SmartVision IAD Dashboard
 */

import React from 'react';
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { cn } from '@/lib/utils';

type DensityLevel = 'low' | 'medium' | 'high' | 'critical';

interface DensityGaugeProps {
  level: DensityLevel | null;
  count: number;
  maxCount?: number;
  height?: number;
  className?: string;
}

const densityConfig: Record<DensityLevel, { color: string; label: string; textColor: string }> = {
  low:      { color: '#22c55e', label: 'Low',      textColor: 'text-emerald-400' },
  medium:   { color: '#f59e0b', label: 'Medium',   textColor: 'text-amber-400' },
  high:     { color: '#ef4444', label: 'High',     textColor: 'text-red-400' },
  critical: { color: '#dc2626', label: 'Critical', textColor: 'text-red-500' },
};

export const DensityGauge = React.memo(function DensityGauge({
  level,
  count,
  maxCount = 100,
  height = 160,
  className,
}: DensityGaugeProps) {
  const cfg = level ? densityConfig[level] : densityConfig.low;
  const pct = Math.min((count / maxCount) * 100, 100);
  const chartData = [{ name: 'density', value: pct, fill: cfg.color }];

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height={height}>
          <RadialBarChart
            innerRadius="60%"
            outerRadius="90%"
            startAngle={220}
            endAngle={-40}
            data={chartData}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: 'hsl(222 47% 16%)' }}
              dataKey="value"
              cornerRadius={8}
              animationDuration={600}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-foreground">{count}</span>
          <span className="text-xs text-muted-foreground">persons</span>
          {level && (
            <span className={cn('text-xs font-semibold mt-1', cfg.textColor)}>
              {cfg.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
