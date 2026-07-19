/**
 * components/charts/DemographicsPieChart.tsx — Gender/demographics pie charts
 * SmartVision IAD Dashboard
 */

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

interface PieDataPoint {
  name: string;
  value: number;
  color: string;
}

interface DemographicsPieChartProps {
  data: PieDataPoint[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}


const CustomLabel = (props: PieLabelRenderProps) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (percent == null || percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const cxN = Number(cx ?? 0);
  const cyN = Number(cy ?? 0);
  const irN = Number(innerRadius ?? 0);
  const orN = Number(outerRadius ?? 0);
  const maN = Number(midAngle ?? 0);
  const radius = irN + (orN - irN) * 0.5;
  const x = cxN + radius * Math.cos(-maN * RADIAN);
  const y = cyN + radius * Math.sin(-maN * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export const DemographicsPieChart = React.memo(function DemographicsPieChart({
  data,
  height = 220,
  innerRadius = 50,
  outerRadius = 85,
}: DemographicsPieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground w-full bg-secondary/10 rounded-lg border border-dashed border-border/50">
        No demographics data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          dataKey="value"
          labelLine={false}
          label={CustomLabel}
          animationBegin={0}
          animationDuration={600}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'hsl(222 47% 11%)',
            border: '1px solid hsl(222 47% 18%)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: 'hsl(215 20% 55%)' }}
          itemStyle={{ color: 'hsl(213 31% 91%)' }}
          formatter={(value) => [`${Number(value ?? 0)}%`, '']}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => <span style={{ color: 'hsl(215 20% 65%)' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
});
