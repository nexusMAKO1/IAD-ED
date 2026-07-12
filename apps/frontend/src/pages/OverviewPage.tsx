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
import { getAudienceStats, getVisitorTimeseries } from '@/api/audience';
import { useLiveDashboard } from '@/hooks/useLiveDashboard';
import { useToast } from '@/hooks/use-toast';
import type { TimeSeriesPoint } from '@/types';

type OutletCtx = { selectedSiteId: string };

// Demo arrays removed; real data comes from the API/MQTT hooks


export function OverviewPage() {
  const { selectedSiteId } = useOutletContext<OutletCtx>();
  const live = useLiveDashboard(selectedSiteId);
  const { toast } = useToast();

  const { data: stats, isLoading: isLoadingStats, isError: isErrorStats } = useQuery({
    queryKey: ['audienceStats', selectedSiteId],
    queryFn: () => getAudienceStats(selectedSiteId),
    enabled: !!selectedSiteId,
    refetchInterval: 30_000,
  });

  const { data: timeseriesData = [], isLoading: isLoadingTs, isError: isErrorTs } = useQuery({
    queryKey: ['visitorTimeseries', selectedSiteId, 'minute'],
    queryFn: () => getVisitorTimeseries(selectedSiteId, 'minute'),
    enabled: !!selectedSiteId,
    refetchInterval: 60_000,
    retry: 1, // Don't retry too much if endpoint is missing
  });

  const { data: hourlyData = [], isLoading: isLoadingHourly, isError: isErrorHourly } = useQuery({
    queryKey: ['visitorTimeseries', selectedSiteId, 'hour'],
    queryFn: () => getVisitorTimeseries(selectedSiteId, 'hour'),
    enabled: !!selectedSiteId,
    refetchInterval: 300_000,
    retry: 1,
  });

  React.useEffect(() => {
    if (isErrorStats || isErrorTs || isErrorHourly) {
      toast({
        title: 'Data Load Error',
        description: 'Failed to fetch some dashboard data. The endpoint may be missing or the server is down.',
        variant: 'destructive',
      });
    }
  }, [isErrorStats, isErrorTs, isErrorHourly, toast]);

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
            Vue d'ensemble
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Intelligence d'audience en temps réel — SmartVision IAD
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
          title="Visiteurs actuels"
          value={currentVisitors}
          icon={Users}
          color="primary"
          trend="up"
          trendLabel={`${dailyVisitors} aujourd'hui`}
          delay={0}
        />
        <KpiCard
          title="Visiteurs du jour"
          value={dailyVisitors}
          icon={TrendingUp}
          color="success"
          trend="up"
          trendLabel="Depuis minuit"
          delay={0.06}
        />
        <KpiCard
          title="Temps de séjour moy."
          value={avgWaitTime}
          unit="min"
          icon={Clock}
          color="warning"
          trend={avgWaitTime > 15 ? 'down' : 'neutral'}
          trendLabel={avgWaitTime > 15 ? 'Au-dessus du seuil' : 'Dans la cible'}
          delay={0.12}
        />
        <KpiCard
          title="Taux d'attention"
          value={`${attentionRate}%`}
          icon={Eye}
          color="primary"
          trend="up"
          trendLabel="Engagement campagne"
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
          title="File d'attente moy."
          value={avgQueueLength}
          icon={Layers}
          color="warning"
          trend={avgQueueLength > 10 ? 'down' : 'neutral'}
          trendLabel={`Seuil: 10`}
          delay={0}
        />
        <KpiCard
          title="Densité de foule"
          value={crowdDensity ? crowdDensity.charAt(0).toUpperCase() + crowdDensity.slice(1) : '—'}
          icon={Waves}
          color={crowdDensity === 'critical' || crowdDensity === 'high' ? 'danger' : crowdDensity === 'medium' ? 'warning' : 'success'}
          trend="neutral"
          trendLabel={`${currentVisitors} personnes détectées`}
          delay={0.06}
        />
        <KpiCard
          title="Hommes"
          value={`${malePercent}%`}
          icon={UserCheck}
          color="primary"
          trend="neutral"
          trendLabel="Répartition par genre"
          delay={0.12}
        />
        <KpiCard
          title="Femmes"
          value={`${femalePercent}%`}
          icon={UserCheck}
          color="primary"
          trend="neutral"
          trendLabel="Répartition par genre"
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
          title="Enfants"
          value={childrenCount}
          icon={Baby}
          color="success"
          trend="neutral"
          subtitle="Moins de 18 ans"
          delay={0}
        />
        <KpiCard
          title="Adultes"
          value={adultsCount}
          icon={PersonStanding}
          color="primary"
          trend="neutral"
          subtitle="18–64 ans"
          delay={0.06}
        />
        <KpiCard
          title="Seniors"
          value={seniorsCount}
          icon={UserX}
          color="muted"
          trend="neutral"
          subtitle="65 ans et plus"
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
                  Visiteurs — 30 dernières min
                </CardTitle>
                <LiveBadge showLabel={false} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTs ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
              ) : isErrorTs ? (
                <div className="h-[200px] flex items-center justify-center text-red-500 text-sm">Failed to load time series data</div>
              ) : (
                <VisitorLineChart data={timeseriesData} useArea height={200} color="#7c3aed" />
              )}
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
                Densité de foule en direct
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
              Visiteurs du jour — Par heure
            </CardTitle>
          </CardHeader>
          <CardContent>
              {isLoadingHourly ? (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
              ) : isErrorHourly ? (
                <div className="h-[180px] flex items-center justify-center text-red-500 text-sm">Failed to load hourly data</div>
              ) : (
                <VisitorLineChart data={hourlyData} useArea={false} height={180} color="#22c55e" />
              )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
