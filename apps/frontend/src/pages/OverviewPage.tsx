/**
 * pages/OverviewPage.tsx — SmartVision IAD Overview Dashboard
 * Premium Blue/Cyan enterprise design
 *
 * Security: No dangerouslySetInnerHTML. All values via React JSX auto-escaping.
 */
import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, Clock, Eye, BarChart2, Layers, UserCheck,
  Baby, PersonStanding, UserX, Waves, TrendingUp, MonitorPlay, Camera, ShieldAlert, AlertTriangle
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { VisitorLineChart } from '@/components/charts/VisitorLineChart';
import { DensityGauge } from '@/components/charts/DensityGauge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonKpiCard } from '@/components/ui/SkeletonCard';
import { getAudienceStats, getVisitorTimeseries } from '@/api/audience';
import { useLiveDashboard } from '@/hooks/useLiveDashboard';
import { getDevices } from '@/api/devices';
import { useMqtt } from '@/mqtt/useMqtt';
import { MQTT_TOPICS } from '@/mqtt/mqtt.topics';

type OutletCtx = { selectedSiteId: string };

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

export function OverviewPage() {
  const { selectedSiteId } = useOutletContext<OutletCtx>();
  const live = useLiveDashboard(selectedSiteId);
  const queryClient = useQueryClient();

  useMqtt(MQTT_TOPICS.FRONTEND.DEVICE_STATUS, () => {
    queryClient.invalidateQueries({ queryKey: ['devices', selectedSiteId] });
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['audienceStats', selectedSiteId],
    queryFn: () => getAudienceStats(selectedSiteId),
    enabled: !!selectedSiteId,
    refetchInterval: 30_000,
  });

  const { data: timeseriesData = [], isLoading: isLoadingTs } = useQuery({
    queryKey: ['visitorTimeseries', selectedSiteId, 'minute'],
    queryFn: () => getVisitorTimeseries(selectedSiteId, 'minute'),
    enabled: !!selectedSiteId,
    refetchInterval: 60_000,
    retry: 1,
  });

  const { data: hourlyData = [], isLoading: isLoadingHourly } = useQuery({
    queryKey: ['visitorTimeseries', selectedSiteId, 'hour'],
    queryFn: () => getVisitorTimeseries(selectedSiteId, 'hour'),
    enabled: !!selectedSiteId,
    refetchInterval: 300_000,
    retry: 1,
  });

  const { data: edgeDevices = [], isLoading: isLoadingCameras } = useQuery({
    queryKey: ['devices', selectedSiteId, 'EDGE_CAMERA'],
    queryFn: () => getDevices({ siteId: selectedSiteId, type: 'EDGE_CAMERA' }),
    enabled: !!selectedSiteId,
  });

  const { data: displayDevices = [], isLoading: isLoadingDisplays } = useQuery({
    queryKey: ['devices', selectedSiteId, 'DISPLAY'],
    queryFn: () => getDevices({ siteId: selectedSiteId, type: 'DISPLAY' }),
    enabled: !!selectedSiteId,
  });

  const siteCameras = edgeDevices;

  const cameraStats = useMemo(() => {
    return siteCameras.reduce((acc: any, dev: any) => {
      acc[dev.status] = (acc[dev.status] || 0) + 1;
      return acc;
    }, { ONLINE: 0, OFFLINE: 0, WARNING: 0, UNKNOWN: 0, UNPAIRED: 0, ERROR: 0 });
  }, [siteCameras]);

  const displayStats = useMemo(() => {
    return displayDevices.reduce((acc: any, dev: any) => {
      acc[dev.status] = (acc[dev.status] || 0) + 1;
      return acc;
    }, { ONLINE: 0, OFFLINE: 0, WARNING: 0, UNKNOWN: 0, UNPAIRED: 0, ERROR: 0 });
  }, [displayDevices]);

  const currentVisitors = live.currentVisitors || stats?.currentVisitors || 0;
  const crowdDensity    = live.crowdDensity    || stats?.crowdDensity    || null;
  const malePercent     = live.malePercent     || stats?.malePercent     || 50;
  const femalePercent   = live.femalePercent   || stats?.femalePercent   || 50;
  const dailyVisitors   = stats?.dailyVisitors  ?? 0;
  const avgWaitTime     = stats?.avgWaitTime    ?? 0;
  const attentionRate   = stats?.attentionRate  ?? 0;
  const avgQueueLength  = stats?.avgQueueLength ?? 0;
  const childrenCount   = stats?.childrenCount  ?? 0;
  const adultsCount     = stats?.adultsCount    ?? 0;
  const seniorsCount    = stats?.seniorsCount   ?? 0;

  if (!selectedSiteId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
          <BarChart2 className="h-8 w-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Sélectionnez un site</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Choisissez un site dans la barre en haut pour afficher les données d'audience en temps réel.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-7">
      <PageHeader
        title="Vue d'ensemble"
        description="Intelligence d'audience en temps réel — SmartVision IAD"
        icon={BarChart2}
      />

      {/* ── Primary KPI Row ───────────────────────────────────────────────── */}
      {isLoadingStats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonKpiCard key={i} />)}
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard title="Visiteurs actuels" value={currentVisitors} icon={Users}
            color="primary" trend="up" trendLabel={`${dailyVisitors} aujourd'hui`} delay={0} />
          <KpiCard title="Visiteurs du jour" value={dailyVisitors} icon={TrendingUp}
            color="success" trend="up" trendLabel="Depuis minuit" delay={0.07} />
          <KpiCard title="Temps de séjour" value={avgWaitTime} unit="min" icon={Clock}
            color="warning" trend={avgWaitTime > 15 ? 'down' : 'neutral'}
            trendLabel={avgWaitTime > 15 ? 'Au-dessus cible' : 'Dans la cible'} delay={0.14} />
          <KpiCard title="Taux d'attention" value={`${attentionRate}%`} icon={Eye}
            color="cyan" trend="up" trendLabel="Engagement campagne" delay={0.21} />
        </motion.div>
      )}

      {/* ── Device Health Row ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
          État des équipements (Temps Réel)
        </h2>
        {isLoadingCameras || isLoadingDisplays ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonKpiCard key={i} />)}
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible"
            className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            <KpiCard title="Caméras Connectées" value={cameraStats.ONLINE} icon={Camera}
              color="success" trend="neutral" trendLabel={`${siteCameras.length} total`} delay={0} />
            <KpiCard title="Caméras Déconnectées" value={cameraStats.OFFLINE + cameraStats.WARNING} icon={AlertTriangle}
              color={cameraStats.OFFLINE > 0 ? "danger" : (cameraStats.WARNING > 0 ? "warning" : "muted")} 
              trend="neutral" trendLabel="Hors-ligne ou instable" delay={0.07} />

            <KpiCard title="Écrans Connectés" value={displayStats.ONLINE} icon={MonitorPlay}
              color="success" trend="neutral" trendLabel={`${displayDevices.length} total`} delay={0.14} />
            <KpiCard title="Écrans Déconnectés" value={displayStats.OFFLINE + displayStats.WARNING} icon={AlertTriangle}
              color={displayStats.OFFLINE > 0 ? "danger" : (displayStats.WARNING > 0 ? "warning" : "muted")} 
              trend="neutral" trendLabel="Hors-ligne ou instable" delay={0.21} />
              
          </motion.div>
        )}
      </div>

      {/* ── Secondary KPI Row ─────────────────────────────────────────────── */}
      {!isLoadingStats && (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard title="File d'attente" value={avgQueueLength} icon={Layers}
            color="warning" trend={avgQueueLength > 10 ? 'down' : 'neutral'}
            trendLabel="Seuil: 10" delay={0} />
          <KpiCard title="Densité foule" icon={Waves}
            value={crowdDensity ? crowdDensity.charAt(0).toUpperCase() + crowdDensity.slice(1) : '—'}
            color={crowdDensity === 'critical' || crowdDensity === 'high' ? 'danger' : crowdDensity === 'medium' ? 'warning' : 'success'}
            trend="neutral" trendLabel={`${currentVisitors} détectés`} delay={0.07} />
          <KpiCard title="Hommes" value={`${malePercent}%`} icon={UserCheck}
            color="primary" trend="neutral" trendLabel="Genre masculin" delay={0.14} />
          <KpiCard title="Femmes" value={`${femalePercent}%`} icon={UserCheck}
            color="purple" trend="neutral" trendLabel="Genre féminin" delay={0.21} />
        </motion.div>
      )}

      {/* ── Charts Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Live visitor chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }} className="lg:col-span-2">
          <Card className="glass-card h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Visiteurs — 30 dernières min
                </CardTitle>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[10px] text-blue-400 font-semibold">En direct</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTs ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="h-6 w-6 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : (
                <VisitorLineChart data={timeseriesData} useArea height={200} color="#2563EB" />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Density Gauge */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Densité de foule
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <DensityGauge level={crowdDensity} count={currentVisitors} maxCount={100} height={200} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Age Breakdown + Hourly Chart ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Age KPIs */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
            Répartition par âge
          </h2>
          {isLoadingStats ? (
            <>{[...Array(3)].map((_, i) => <SkeletonKpiCard key={i} />)}</>
          ) : (
            <>
              <KpiCard title="Enfants" value={childrenCount} icon={Baby}
                color="success" trend="neutral" subtitle="Moins de 18 ans" />
              <KpiCard title="Adultes" value={adultsCount} icon={PersonStanding}
                color="primary" trend="neutral" subtitle="18–64 ans" />
              <KpiCard title="Seniors" value={seniorsCount} icon={UserX}
                color="muted" trend="neutral" subtitle="65 ans et plus" />
            </>
          )}
        </div>

        {/* Hourly chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }} className="lg:col-span-2">
          <Card className="glass-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Visiteurs du jour — par heure
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHourly ? (
                <div className="h-[220px] flex items-center justify-center">
                  <div className="h-6 w-6 border-2 border-emerald-500/40 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : (
                <VisitorLineChart data={hourlyData} useArea={false} height={220} color="#22C55E" />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
