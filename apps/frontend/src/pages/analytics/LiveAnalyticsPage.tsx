/**
 * pages/analytics/LiveAnalyticsPage.tsx — Real-time charts dashboard
 * SmartVision IAD Dashboard
 */

import React, { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveBadge } from '@/components/dashboard/LiveBadge';
import { VisitorLineChart, MultiVisitorChart } from '@/components/charts/VisitorLineChart';
import { DensityGauge } from '@/components/charts/DensityGauge';
import { useLiveDashboard } from '@/hooks/useLiveDashboard';
import { getVisitorTimeseries } from '@/api/audience';
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

  const { data: timeseriesMinute = [], isLoading: isLoadingMin } = useQuery({
    queryKey: ['visitorTimeseries', selectedSiteId, 'minute'],
    queryFn: () => getVisitorTimeseries(selectedSiteId, 'minute'),
    enabled: !!selectedSiteId,
    refetchInterval: 30_000,
  });

  const { data: timeseriesHour = [], isLoading: isLoadingHour } = useQuery({
    queryKey: ['visitorTimeseries', selectedSiteId, 'hour'],
    queryFn: () => getVisitorTimeseries(selectedSiteId, 'hour'),
    enabled: !!selectedSiteId,
    refetchInterval: 60_000,
  });

  if (!selectedSiteId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
          <Zap className="h-8 w-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Select a Site</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Please select a site from the top navigation to view live analytics.
        </p>
      </div>
    );
  }

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
              {isLoadingMin ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <VisitorLineChart data={timeseriesMinute} useArea color="#7c3aed" height={200} />
              )}
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
              {isLoadingHour ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <VisitorLineChart data={timeseriesHour} useArea={false} color="#22c55e" height={200} />
              )}
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
              {isLoadingHour ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="h-6 w-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <MultiVisitorChart data={timeseriesHour} height={200} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
