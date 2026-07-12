/**
 * components/charts/AgeBarChart.tsx — Age distribution bar chart
 * SmartVision IAD Dashboard
 */

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
} from 'recharts';

interface AgeGroupPoint {
  group: string;
  count: number;
}

interface AgeBarChartProps {
  data: AgeGroupPoint[];
  height?: number;
}

const AGE_COLORS = ['#3b82f6', '#7c3aed', '#ec4899', '#f59e0b', '#10b981'];

export const AgeBarChart = React.memo(function AgeBarChart({
  data,
  height = 220,
}: AgeBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground w-full bg-secondary/10 rounded-lg border border-dashed border-border/50">
        No age data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 18%)" vertical={false} />
        <XAxis dataKey="group" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: 'hsl(222 47% 11%)',
            border: '1px solid hsl(222 47% 18%)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: 'hsl(215 20% 55%)' }}
          itemStyle={{ color: 'hsl(213 31% 91%)' }}
          cursor={{ fill: 'hsl(222 47% 18% / 0.5)' }}
        />
        <Bar dataKey="count" name="Visitors" radius={[4, 4, 0, 0]} animationDuration={600}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={AGE_COLORS[index % AGE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

// Stacked bar chart for gender by hour
interface GenderByHourPoint {
  hour: string;
  male: number;
  female: number;
}

interface GenderHourChartProps {
  data: GenderByHourPoint[];
  height?: number;
}

export const GenderHourChart = React.memo(function GenderHourChart({
  data,
  height = 220,
}: GenderHourChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground w-full bg-secondary/10 rounded-lg border border-dashed border-border/50">
        No gender split data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 18%)" vertical={false} />
        <XAxis dataKey="hour" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: 'hsl(222 47% 11%)',
            border: '1px solid hsl(222 47% 18%)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: 'hsl(215 20% 55%)' }}
          itemStyle={{ color: 'hsl(213 31% 91%)' }}
          cursor={{ fill: 'hsl(222 47% 18% / 0.5)' }}
        />
        <Legend
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value) => <span style={{ color: 'hsl(215 20% 65%)' }}>{value}</span>}
        />
        <Bar dataKey="male" name="Male" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} animationDuration={600} />
        <Bar dataKey="female" name="Female" stackId="a" fill="#ec4899" radius={[4, 4, 0, 0]} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
});
