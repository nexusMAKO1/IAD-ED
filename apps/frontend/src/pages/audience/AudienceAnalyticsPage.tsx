/**
 * pages/audience/AudienceAnalyticsPage.tsx — Demographics & audience analytics
 * SmartVision IAD Dashboard — fully wired to real API + MQTT live stream
 */

import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Clock, Star, TrendingUp, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { DemographicsPieChart } from '@/components/charts/DemographicsPieChart';
import { AgeBarChart, GenderHourChart } from '@/components/charts/AgeBarChart';
import { VisitorLineChart } from '@/components/charts/VisitorLineChart';
import { getAudienceStats, getAudienceEvents } from '@/api/audience';
import { mqttClient } from '@/mqtt/mqtt.client';
import { MQTT_TOPICS } from '@/mqtt/mqtt.topics';

type OutletCtx = { selectedSiteId: string };

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

interface AudienceEvent {
  id: string;
  timestamp: string;
  ageGroup: string;
  gender?: string;
  emotion?: string;
  dwellTime?: number;
  siteId: string;
}

export function AudienceAnalyticsPage() {
  const { selectedSiteId } = useOutletContext<OutletCtx>();
  const [liveEvents, setLiveEvents] = useState<AudienceEvent[]>([]);

  // REST — historical stats
  const { data: stats, isLoading: isLoadingStats, isError: isErrorStats } = useQuery({
    queryKey: ['audienceStats', selectedSiteId],
    queryFn: () => getAudienceStats(selectedSiteId),
    enabled: !!selectedSiteId,
    refetchInterval: 30_000,
  });

  // REST — recent events list (historical)
  const { data: histEvents = [], isLoading: isLoadingEvents, isError: isErrorEvents } = useQuery({
    queryKey: ['audienceEvents', selectedSiteId],
    queryFn: () => getAudienceEvents(selectedSiteId),
    enabled: !!selectedSiteId,
    refetchInterval: 60_000,
    retry: 1,
  });

  // MQTT — prepend live detections to the top of the events list
  useEffect(() => {
    if (!selectedSiteId) return;

    const unsubscribe = mqttClient.subscribe(
      MQTT_TOPICS.EDGE.DEMOGRAPHICS,
      (_topic, envelope) => {
        const payload = envelope.payload as Record<string, unknown>;
        if (!payload) return;
        const evt: AudienceEvent = {
          id: `live-${Date.now()}`,
          timestamp: envelope.timestamp,
          ageGroup: (payload['ageGroup'] as string) || (payload['age_group'] as string) || 'unknown',
          gender: payload['gender'] as string | undefined,
          emotion: payload['emotion'] as string | undefined,
          dwellTime: payload['dwellTime'] as number | undefined,
          siteId: envelope.siteId,
        };
        setLiveEvents(prev => [evt, ...prev].slice(0, 50));
      },
    );

    return () => {
      unsubscribe();
    };
  }, [selectedSiteId]);

  const allEvents: AudienceEvent[] = [...liveEvents, ...(histEvents as AudienceEvent[])];

  // Compute peak hour from events
  const peakHour = React.useMemo(() => {
    if (!allEvents.length) return '--';
    const counts: Record<number, number> = {};
    allEvents.forEach(e => {
      const h = new Date(e.timestamp).getHours();
      counts[h] = (counts[h] || 0) + 1;
    });
    const maxH = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0];
    return maxH != null ? `${String(maxH).padStart(2, '0')}:00` : '--';
  }, [allEvents]);

  // Build gender pie chart data from stats
  const genderData = stats ? [
    { name: 'Hommes', value: stats.malePercent ?? 50, color: '#7c3aed' },
    { name: 'Femmes', value: stats.femalePercent ?? 50, color: '#ec4899' },
  ] : [];

  // Build age bar chart data from stats
  const ageData = stats ? [
    { label: 'Enfants', count: stats.childrenCount ?? 0 },
    { label: 'Adultes', count: stats.adultsCount ?? 0 },
    { label: 'Seniors', count: stats.seniorsCount ?? 0 },
  ] : [];

  if (!selectedSiteId) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <p>Veuillez sélectionner un site pour afficher les données d'audience.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border pb-6"
      >
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" aria-hidden="true" />
          Analytique d'audience
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Démographie, comportements et composition de l'audience en temps réel
        </p>
      </motion.div>

      {/* Error banner */}
      {(isErrorStats || isErrorEvents) && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Certaines données n'ont pas pu être chargées. Vérifiez que le backend est disponible.</span>
        </div>
      )}

      {/* Summary KPIs */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={item}>
          <KpiCard
            title="Visiteurs actuels"
            value={isLoadingStats ? '…' : stats?.currentVisitors ?? '--'}
            icon={Users}
            color="primary"
            trend="neutral"
            trendLabel={stats ? `${stats.dailyVisitors ?? 0} aujourd'hui` : 'Chargement…'}
          />
        </motion.div>
        <motion.div variants={item}>
          <KpiCard
            title="Visiteurs du jour"
            value={isLoadingStats ? '…' : stats?.dailyVisitors ?? '--'}
            icon={Star}
            color="success"
            trend="neutral"
            trendLabel="Depuis minuit"
          />
        </motion.div>
        <motion.div variants={item}>
          <KpiCard
            title="Heure de pointe"
            value={isLoadingStats ? '…' : peakHour}
            icon={Clock}
            color="warning"
            trend="neutral"
            trendLabel="Basé sur l'historique"
          />
        </motion.div>
        <motion.div variants={item}>
          <KpiCard
            title="Évènements live"
            value={liveEvents.length}
            icon={TrendingUp}
            color="primary"
            trend="up"
            trendLabel="Via MQTT"
          />
        </motion.div>
      </motion.div>

      {/* Charts Grid */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gender Pie */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Répartition par genre</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">Chargement…</div>
              ) : (
                <DemographicsPieChart data={genderData} height={240} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Age Distribution */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Répartition par âge</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">Chargement…</div>
              ) : (
                <AgeBarChart data={ageData} height={240} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Live Events Feed */}
        <motion.div variants={item} className="md:col-span-2">
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Flux de détections live
                </CardTitle>
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  {liveEvents.length} live · {(histEvents as AudienceEvent[]).length} historique
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingEvents && !liveEvents.length ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Chargement de l'historique…</div>
              ) : allEvents.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Aucun événement détecté. En attente de données MQTT…</div>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-border text-sm">
                  {allEvents.slice(0, 40).map((evt) => (
                    <div key={evt.id} className="flex items-center justify-between py-2 px-1 hover:bg-secondary/30">
                      <span className="text-muted-foreground tabular-nums w-28 shrink-0">
                        {new Date(evt.timestamp).toLocaleTimeString('fr-FR')}
                      </span>
                      <span className="capitalize font-medium">{evt.ageGroup.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground capitalize">{evt.gender ?? '—'}</span>
                      <span className="text-muted-foreground capitalize">{evt.emotion ?? '—'}</span>
                      <span className="text-muted-foreground">{evt.dwellTime != null ? `${evt.dwellTime}s` : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
