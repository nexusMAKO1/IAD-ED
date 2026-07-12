/**
 * pages/audience/AudienceAnalyticsPage.tsx — Demographics & audience analytics
 * IAD SmartVision Dashboard — Blue/Cyan enterprise theme
 * Fully wired to real API + MQTT live stream
 */
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Clock, Star, TrendingUp, AlertCircle, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonKpiCard } from '@/components/ui/SkeletonCard';
import { DemographicsPieChart } from '@/components/charts/DemographicsPieChart';
import { AgeBarChart } from '@/components/charts/AgeBarChart';
import { getAudienceStats, getAudienceEvents } from '@/api/audience';
import { mqttClient } from '@/mqtt/mqtt.client';
import { MQTT_TOPICS } from '@/mqtt/mqtt.topics';
import type { AudienceEvent } from '@/types';

type OutletCtx = { selectedSiteId: string };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

// Colour map for age groups in the live feed
const AGE_COLORS: Record<string, string> = {
  child:      'text-amber-400 bg-amber-500/10 border-amber-500/20',
  teenager:   'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  adult:      'text-blue-400 bg-blue-500/10 border-blue-500/20',
  senior:     'text-purple-400 bg-purple-500/10 border-purple-500/20',
  unknown:    'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

const GENDER_COLORS: Record<string, string> = {
  male:   'text-blue-400',
  female: 'text-pink-400',
};

export function AudienceAnalyticsPage() {
  const { selectedSiteId } = useOutletContext<OutletCtx>();
  const [liveEvents, setLiveEvents] = useState<AudienceEvent[]>([]);

  const { data: stats, isLoading: isLoadingStats, isError: isErrorStats } = useQuery({
    queryKey: ['audienceStats', selectedSiteId],
    queryFn: () => getAudienceStats(selectedSiteId),
    enabled: !!selectedSiteId,
    refetchInterval: 30_000,
  });

  const { data: histEvents = [], isLoading: isLoadingEvents, isError: isErrorEvents } = useQuery({
    queryKey: ['audienceEvents', selectedSiteId],
    queryFn: () => getAudienceEvents(selectedSiteId),
    enabled: !!selectedSiteId,
    refetchInterval: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!selectedSiteId) return;
    const unsubscribe = mqttClient.subscribe(MQTT_TOPICS.EDGE.DEMOGRAPHICS, (_topic, envelope) => {
      const payload = envelope.payload as Record<string, unknown>;
      if (!payload) return;
      const evt: AudienceEvent = {
        id: `live-${Date.now()}`,
        timestamp: envelope.timestamp,
        ageGroup: (payload['ageGroup'] as string) || (payload['age_group'] as string) || 'unknown',
        gender: (payload['gender'] as string) || 'unknown',
        emotion: payload['emotion'] as string | undefined,
        dwellTime: payload['dwellTime'] as number | undefined,
        siteId: envelope.siteId,
        confidence: (payload['confidence'] as number) || 1.0,
        count: (payload['count'] as number) || 1,
      };
      setLiveEvents(prev => [evt, ...prev].slice(0, 50));
    });
    return () => { unsubscribe(); };
  }, [selectedSiteId]);

  const allEvents: AudienceEvent[] = [...liveEvents, ...(histEvents || [])];

  const peakHour = React.useMemo(() => {
    if (!allEvents.length) return '--';
    const counts: Record<number, number> = {};
    allEvents.forEach(e => { const h = new Date(e.timestamp).getHours(); counts[h] = (counts[h] || 0) + 1; });
    const maxH = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0];
    return maxH != null ? `${String(maxH).padStart(2, '0')}:00` : '--';
  }, [allEvents]);

  const genderData = stats ? [
    { name: 'Hommes',  value: stats.malePercent   ?? 50, color: '#2563EB' },
    { name: 'Femmes',  value: stats.femalePercent  ?? 50, color: '#EC4899' },
  ] : [];

  const ageData = stats ? [
    { label: 'Enfants', count: stats.childrenCount ?? 0 },
    { label: 'Adultes', count: stats.adultsCount   ?? 0 },
    { label: 'Seniors', count: stats.seniorsCount  ?? 0 },
  ] : [];

  if (!selectedSiteId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Sélectionnez un site</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Choisissez un site pour afficher les données démographiques d'audience.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-7">
      <PageHeader
        title="Analytique d'audience"
        description="Démographie, comportements et composition de l'audience en temps réel"
        icon={Users}
      />

      {/* Error banner */}
      {(isErrorStats || isErrorEvents) && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Certaines données n'ont pas pu être chargées. Vérifiez que le backend est disponible.</span>
        </div>
      )}

      {/* KPI Row */}
      {isLoadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonKpiCard key={i} />)}
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Visiteurs actuels" value={stats?.currentVisitors ?? '--'} icon={Users}
            color="primary" trend="neutral" trendLabel={`${stats?.dailyVisitors ?? 0} aujourd'hui`} delay={0} />
          <KpiCard title="Visiteurs du jour" value={stats?.dailyVisitors ?? '--'} icon={Star}
            color="success" trend="neutral" trendLabel="Depuis minuit" delay={0.07} />
          <KpiCard title="Heure de pointe" value={peakHour} icon={Clock}
            color="warning" trend="neutral" trendLabel="Basé sur l'historique" delay={0.14} />
          <KpiCard title="Détections live" value={liveEvents.length} icon={Activity}
            color="cyan" trend="up" trendLabel="Via MQTT" delay={0.21} />
        </motion.div>
      )}

      {/* Charts Grid */}
      <motion.div variants={stagger} initial="hidden" animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Gender Pie */}
        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Répartition par genre
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="h-[240px] flex items-center justify-center">
                  <div className="h-6 w-6 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : (
                <DemographicsPieChart data={genderData} height={240} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Age Distribution */}
        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { delay: 0.07 } } }}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Répartition par âge
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="h-[240px] flex items-center justify-center">
                  <div className="h-6 w-6 border-2 border-emerald-500/40 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : (
                <AgeBarChart data={ageData} height={240} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Live Events Feed */}
        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { delay: 0.14 } } }}
          className="md:col-span-2">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Flux de détections live
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    {liveEvents.length} live
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(histEvents || []).length} historique
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingEvents && !liveEvents.length ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  <div className="h-5 w-5 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                  Chargement de l'historique…
                </div>
              ) : allEvents.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  <Activity className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  Aucun événement détecté. En attente de données MQTT…
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden border border-border/30">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/20">
                        <th className="px-4 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground">Heure</th>
                        <th className="px-4 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground">Groupe d'âge</th>
                        <th className="px-4 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground">Genre</th>
                        <th className="px-4 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground">Émotion</th>
                        <th className="px-4 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground">Durée</th>
                      </tr>
                    </thead>
                    <tbody className="max-h-64 overflow-y-auto divide-y divide-border/20">
                      {allEvents.slice(0, 40).map((evt, i) => {
                        const ageKey = String(evt.ageGroup || 'unknown').toLowerCase().replace(/\s+/g, '_');
                        const ageColor = AGE_COLORS[ageKey] ?? AGE_COLORS.unknown;
                        const genderColor = GENDER_COLORS[evt.gender?.toLowerCase() ?? ''] ?? 'text-muted-foreground';
                        return (
                          <motion.tr
                            key={evt.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="hover:bg-white/3 transition-colors"
                          >
                            <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                              {new Date(evt.timestamp).toLocaleTimeString('fr-FR')}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${ageColor}`}>
                                {String(evt.ageGroup || 'Unknown').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className={`px-4 py-2.5 font-medium capitalize ${genderColor}`}>{evt.gender ?? '—'}</td>
                            <td className="px-4 py-2.5 text-muted-foreground capitalize">{evt.emotion ?? '—'}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {evt.dwellTime != null ? `${evt.dwellTime}s` : '—'}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
