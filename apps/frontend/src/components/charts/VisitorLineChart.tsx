/**
 * components/charts/VisitorLineChart.tsx — Visitors over time (Recharts)
 * SmartVision IAD Dashboard
 */

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import type { TimeSeriesPoint } from '@/types';

interface VisitorLineChartProps {
  data: TimeSeriesPoint[];
  title?: string;
  color?: string;
  useArea?: boolean;
  height?: number;
}

// Custom tooltip — no dangerouslySetInnerHTML
const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold text-foreground">{payload[0].value} visitors</p>
    </div>
  );
};

export const VisitorLineChart = React.memo(function VisitorLineChart({
  data,
  color = '#7c3aed',
  useArea = true,
  height = 220,
}: VisitorLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground w-full bg-secondary/10 rounded-lg border border-dashed border-border/50">
        No historical data
      </div>
    );
  }

  if (useArea) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="visitorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 18%)" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill="url(#visitorGrad)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 18%)" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          animationDuration={600}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});


// Multi-series visitor chart (hour by hour, split by metric)
interface MultiSeriesPoint {
  time: string;
  visitors?: number;
  density?: number;
  queue?: number;
}

interface MultiVisitorChartProps {
  data: MultiSeriesPoint[];
  height?: number;
}

export const MultiVisitorChart = React.memo(function MultiVisitorChart({
  data,
  height = 220,
}: MultiVisitorChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground w-full bg-secondary/10 rounded-lg border border-dashed border-border/50">
        No historical data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 18%)" vertical={false} />
        <XAxis dataKey="time" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'hsl(222 47% 11%)', border: '1px solid hsl(222 47% 18%)', borderRadius: 8 }}
          labelStyle={{ color: 'hsl(215 20% 55%)', fontSize: 11 }}
          itemStyle={{ color: 'hsl(213 31% 91%)', fontSize: 11 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(value) => <span style={{ color: 'hsl(215 20% 65%)' }}>{value}</span>}
        />
        <Line type="monotone" dataKey="visitors" name="Visitors" stroke="#7c3aed" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="queue" name="Queue" stroke="#f59e0b" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
});
