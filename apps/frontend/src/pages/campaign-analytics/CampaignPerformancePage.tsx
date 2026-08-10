import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Eye,
  TrendingUp,
  Clock,
  Activity,
  Users,
  Target,
  ChevronRight,
  ArrowRight,
  Medal,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { campaignAnalyticsApi } from '@/api/campaignAnalytics';
import { PerformanceGrade } from '@/types';

const GradeBadge = ({ grade }: { grade: PerformanceGrade }) => {
  const colors = {
    EXCELLENT: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    VERY_GOOD: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
    GOOD: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    AVERAGE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    WEAK: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };

  const labels = {
    EXCELLENT: 'Excellent',
    VERY_GOOD: 'Très bon',
    GOOD: 'Bon',
    AVERAGE: 'Moyen',
    WEAK: 'Faible',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-md border ${colors[grade]}`}>
      {labels[grade]}
    </span>
  );
};

export const CampaignPerformancePage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['campaignOverview'],
    queryFn: campaignAnalyticsApi.getOverview,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const kpis = [
    { label: 'Impressions Totales', value: data?.totalImpressions.toLocaleString(), icon: Eye, color: 'text-blue-500' },
    { label: 'Portée (Reach)', value: data?.totalReach.toLocaleString(), icon: Users, color: 'text-emerald-500' },
    { label: 'Taux d\'Attention', value: `${data?.avgAttentionRate}%`, icon: Target, color: 'text-purple-500' },
    { label: 'Temps Moyen (s)', value: data?.avgViewTimeSec, icon: Clock, color: 'text-amber-500' },
    { label: 'Score Global', value: `${data?.avgPerformanceScore}/100`, icon: Activity, color: 'text-pink-500' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Performance Publicitaire"
          description="Mesurez l'impact réel de vos campagnes avec les données Edge-CV."
        />
        <div className="flex gap-4">
          <Link to="/campaigns/compare">
            <Button variant="outline" className="gap-2">
              <BarChart className="w-4 h-4" />
              Comparer
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {kpis.map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-white/10 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-white/5 ${kpi.color}`}>
                    <kpi.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold">{kpi.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Classement des Campagnes
          </h2>
          
          <Card className="bg-card/30 backdrop-blur-xl border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-white/5">
                  <tr>
                    <th className="px-6 py-4 font-medium">Rang</th>
                    <th className="px-6 py-4 font-medium">Campagne</th>
                    <th className="px-6 py-4 font-medium">Impressions</th>
                    <th className="px-6 py-4 font-medium">Attention</th>
                    <th className="px-6 py-4 font-medium">Score</th>
                    <th className="px-6 py-4 font-medium">Note</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data?.leaderboard.map((item, idx) => (
                    <motion.tr 
                      key={item.campaignId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + (idx * 0.05) }}
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {idx < 3 && <Medal className={`w-4 h-4 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : 'text-amber-700'}`} />}
                          <span className={idx < 3 ? 'font-bold' : ''}>#{item.rank}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">{item.campaignName}</td>
                      <td className="px-6 py-4">{item.totalImpressions.toLocaleString()}</td>
                      <td className="px-6 py-4">{item.attentionRate}%</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-white/10 rounded-full h-2 max-w-[60px]">
                            <div className="bg-primary h-2 rounded-full" style={{ width: `${item.performanceScore}%` }} />
                          </div>
                          <span>{item.performanceScore}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <GradeBadge grade={item.grade} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link to={`/campaigns/${item.campaignId}/analytics`}>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            Détails <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                  {data?.leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                        Aucune donnée de performance disponible.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Aperçu Rapide
          </h2>
          
          {data?.bestCampaign && (
            <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20 backdrop-blur-xl">
              <CardContent className="p-6">
                <p className="text-sm text-emerald-500 font-medium mb-2">Meilleure Performance</p>
                <h3 className="text-xl font-bold truncate mb-4">{data.bestCampaign.campaignName}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score global</span>
                    <span className="font-medium text-emerald-400">{data.bestCampaign.performanceScore}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taux d'attention</span>
                    <span className="font-medium text-emerald-400">{data.bestCampaign.attentionRate}%</span>
                  </div>
                </div>
                <Link to={`/campaigns/${data.bestCampaign.campaignId}/analytics`}>
                  <Button variant="outline" className="w-full mt-4 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400">
                    Analyser <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {data?.worstCampaign && data.leaderboard.length > 1 && (
            <Card className="bg-gradient-to-br from-rose-500/10 to-transparent border-rose-500/20 backdrop-blur-xl">
              <CardContent className="p-6">
                <p className="text-sm text-rose-500 font-medium mb-2">À Améliorer</p>
                <h3 className="text-xl font-bold truncate mb-4">{data.worstCampaign.campaignName}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score global</span>
                    <span className="font-medium text-rose-400">{data.worstCampaign.performanceScore}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taux d'attention</span>
                    <span className="font-medium text-rose-400">{data.worstCampaign.attentionRate}%</span>
                  </div>
                </div>
                <Link to={`/campaigns/${data.worstCampaign.campaignId}/analytics`}>
                  <Button variant="outline" className="w-full mt-4 bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20 text-rose-400">
                    Diagnostiquer <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
