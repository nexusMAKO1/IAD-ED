/**
 * pages/analytics/LiveAnalyticsPage.tsx — Real-time charts dashboard
 * SmartVision IAD Dashboard
 */

import React, { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveBadge } from '@/components/dashboard/LiveBadge';
import { VisitorLineChart, MultiVisitorChart } from '@/components/charts/VisitorLineChart';
import { DensityGauge } from '@/components/charts/DensityGauge';
import { useLiveDashboard } from '@/hooks/useLiveDashboard';
import type { TimeSeriesPoint } from '@/types';

type OutletCtx = { selectedSiteId: string };

function useRollingBuffer<T>(maxLength: number) {
  const [buffer, setBuffer] = useState<T[]>([]);
  const push = useCallback((item: T) => {
    setBuffer((prev) => {
      const next = [...prev, item];
      return next.length > maxLength ? next.slice(-maxLength) : next;
    });
  }, [maxLength]);
  return { buffer, push };
}

// Demo arrays removed; real data comes from the MQTT hooks

export function LiveAnalyticsPage() {
  const { selectedSiteId } = useOutletContext<OutletCtx>();
  const live = useLiveDashboard(selectedSiteId);

  const staggered = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-6"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" aria-hidden="true" />
            Live Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time stream from edge AI inference
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="glass-card px-3 py-1.5 text-xs">
            FPS: <span className="font-bold text-primary">{live.fps.toFixed(1)}</span>
          </div>
          <div className="glass-card px-3 py-1.5 text-xs">
            CPU: <span className="font-bold text-amber-400">{live.cpuPercent.toFixed(0)}%</span>
          </div>
          <div className="glass-card px-3 py-1.5 text-xs">
            Latency: <span className="font-bold text-emerald-400">{live.latencyMs.toFixed(0)}ms</span>
          </div>
          <LiveBadge />
        </div>
      </motion.div>

      <motion.div
        variants={staggered}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Visitors per minute */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Visitors / Minute
                </CardTitle>
                <LiveBadge showLabel={false} />
              </div>
            </CardHeader>
            <CardContent>
              <VisitorLineChart data={[]} useArea color="#7c3aed" height={200} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Crowd density gauge */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Live Crowd Density
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <DensityGauge
                level={live.crowdDensity}
                count={live.currentVisitors}
                maxCount={100}
                height={200}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Visitors per hour */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Visitors Today — Hourly
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VisitorLineChart data={[]} useArea={false} color="#22c55e" height={200} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Queue evolution */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Visitor & Queue Evolution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MultiVisitorChart data={[]} height={200} />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
