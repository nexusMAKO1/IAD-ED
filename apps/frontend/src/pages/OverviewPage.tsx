/**
 * pages/OverviewPage.tsx — SmartVision Dashboard Overview
 * Replaces placeholder with full 11-KPI animated dashboard.
 *
 * Security: No dangerouslySetInnerHTML. All values via React JSX auto-escaping.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, Clock, Eye, BarChart2, Layers, UserCheck,
  Baby, PersonStanding, UserX, Waves, TrendingUp,
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { LiveBadge } from '@/components/dashboard/LiveBadge';
import { VisitorLineChart } from '@/components/charts/VisitorLineChart';
import { DensityGauge } from '@/components/charts/DensityGauge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAudienceStats } from '@/api/audience';
import { useLiveDashboard } from '@/hooks/useLiveDashboard';
import type { TimeSeriesPoint } from '@/types';

type OutletCtx = { selectedSiteId: string };

// Demo arrays removed; real data comes from the API/MQTT hooks


export function OverviewPage() {
  const { selectedSiteId } = useOutletContext<OutletCtx>();
  const live = useLiveDashboard(selectedSiteId);

  const { data: stats } = useQuery({
    queryKey: ['audienceStats', selectedSiteId],
    queryFn: () => getAudienceStats(selectedSiteId),
    enabled: !!selectedSiteId,
    refetchInterval: 30_000,
  });

  // Merge live MQTT data over REST fallback
  const currentVisitors = live.currentVisitors || stats?.currentVisitors || 0;
  const crowdDensity    = live.crowdDensity    || stats?.crowdDensity    || null;
  const malePercent     = live.malePercent     || stats?.malePercent     || 50;
  const femalePercent   = live.femalePercent   || stats?.femalePercent   || 50;

  const dailyVisitors  = stats?.dailyVisitors  ?? 0;
  const avgWaitTime    = stats?.avgWaitTime    ?? 0;
  const attentionRate  = stats?.attentionRate  ?? 0;
  const avgQueueLength = stats?.avgQueueLength ?? 0;
  const childrenCount  = stats?.childrenCount  ?? 0;
  const adultsCount    = stats?.adultsCount    ?? 0;
  const seniorsCount   = stats?.seniorsCount   ?? 0;

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-6"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" aria-hidden="true" />
            Dashboard Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time audience intelligence — SmartVision IAD
          </p>
        </div>
        <LiveBadge />
      </motion.div>

      {/* ── Primary KPI Row ─────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4"
      >
        <KpiCard
          title="Current Visitors"
          value={currentVisitors}
          icon={Users}
          color="primary"
          trend="up"
          trendLabel={`${dailyVisitors} today`}
          delay={0}
        />
        <KpiCard
          title="Today's Visitors"
          value={dailyVisitors}
          icon={TrendingUp}
          color="success"
          trend="up"
          trendLabel="Since midnight"
          delay={0.06}
        />
        <KpiCard
          title="Avg Stay Time"
          value={avgWaitTime}
          unit="min"
          icon={Clock}
          color="warning"
          trend={avgWaitTime > 15 ? 'down' : 'neutral'}
          trendLabel={avgWaitTime > 15 ? 'Above threshold' : 'Within target'}
          delay={0.12}
        />
        <KpiCard
          title="Attention Rate"
          value={`${attentionRate}%`}
          icon={Eye}
          color="primary"
          trend="up"
          trendLabel="Campaign engagement"
          delay={0.18}
        />
      </motion.div>

      {/* ── Secondary KPI Row ────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4"
      >
        <KpiCard
          title="Avg Queue"
          value={avgQueueLength}
          icon={Layers}
          color="warning"
          trend={avgQueueLength > 10 ? 'down' : 'neutral'}
          trendLabel={`Threshold: 10`}
          delay={0}
        />
        <KpiCard
          title="Crowd Density"
          value={crowdDensity ? crowdDensity.charAt(0).toUpperCase() + crowdDensity.slice(1) : '—'}
          icon={Waves}
          color={crowdDensity === 'critical' || crowdDensity === 'high' ? 'danger' : crowdDensity === 'medium' ? 'warning' : 'success'}
          trend="neutral"
          trendLabel={`${currentVisitors} persons detected`}
          delay={0.06}
        />
        <KpiCard
          title="Male"
          value={`${malePercent}%`}
          icon={UserCheck}
          color="primary"
          trend="neutral"
          trendLabel="Gender split"
          delay={0.12}
        />
        <KpiCard
          title="Female"
          value={`${femalePercent}%`}
          icon={UserCheck}
          color="primary"
          trend="neutral"
          trendLabel="Gender split"
          delay={0.18}
        />
      </motion.div>

      {/* ── Age KPI Row ─────────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-3 gap-4"
      >
        <KpiCard
          title="Children"
          value={childrenCount}
          icon={Baby}
          color="success"
          trend="neutral"
          subtitle="Under 18"
          delay={0}
        />
        <KpiCard
          title="Adults"
          value={adultsCount}
          icon={PersonStanding}
          color="primary"
          trend="neutral"
          subtitle="18–64 years"
          delay={0.06}
        />
        <KpiCard
          title="Seniors"
          value={seniorsCount}
          icon={UserX}
          color="muted"
          trend="neutral"
          subtitle="65+ years"
          delay={0.12}
        />
      </motion.div>

      {/* ── Charts Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visitors per minute */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Visitors — Last 30 min
                </CardTitle>
                <LiveBadge showLabel={false} />
              </div>
            </CardHeader>
            <CardContent>
              <VisitorLineChart data={[]} useArea height={200} color="#7c3aed" />
            </CardContent>
          </Card>
        </motion.div>

        {/* Density Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <Card className="glass h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Live Crowd Density
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <DensityGauge
                level={crowdDensity}
                count={currentVisitors}
                maxCount={100}
                height={200}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Hourly Visitor Chart ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Visitors Today — Hourly
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VisitorLineChart data={[]} useArea={false} height={180} color="#22c55e" />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
