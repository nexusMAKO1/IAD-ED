import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area
} from 'recharts';
import {
  ArrowLeft, Download, Activity, Users, Eye, Target, Clock,
  Brain, AlertCircle, PlayCircle, BarChart3, TrendingUp
} from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${colors[grade]}`}>
      {labels[grade]}
    </span>
  );
};

export const CampaignDetailPage = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['campaignDetail', id],
    queryFn: () => campaignAnalyticsApi.getCampaignDetail(id!),
    enabled: !!id,
    refetchInterval: 60000,
  });

  const handleExport = () => {
    if (!id) return;
    window.open(campaignAnalyticsApi.exportCsvUrl(id), '_blank');
  };

  if (isLoading || !data) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const audienceData = [
    { name: 'Enfants', value: data.audienceBreakdown.child, fill: '#8b5cf6' },
    { name: 'Jeunes Adultes', value: data.audienceBreakdown.youngAdult, fill: '#3b82f6' },
    { name: 'Adultes', value: data.audienceBreakdown.adult, fill: '#10b981' },
    { name: 'Seniors', value: data.audienceBreakdown.senior, fill: '#f59e0b' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/campaigns/performance">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <PageHeader
            title={data.metrics.campaignName}
            description={`Analyse détaillée des performances de diffusion`}
          />
        </div>
        <div className="flex items-center gap-4">
          <GradeBadge grade={data.metrics.grade} />
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {data.latestInsight && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-transparent border-blue-500/20 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl h-fit">
                  <Brain className="w-6 h-6" />
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
                      Analyse IA SmartVision
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {data.latestInsight.text}
                    </p>
                  </div>
                  {data.latestInsight.recommendations.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-sm font-medium mb-2 text-white/80">Recommandations d'optimisation :</h4>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        {data.latestInsight.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/30 backdrop-blur-xl border-white/5">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Score d'Engagement</p>
                <p className="text-3xl font-bold mt-2">{data.metrics.engagementScore}<span className="text-lg text-muted-foreground">/100</span></p>
              </div>
              <div className="p-3 rounded-xl bg-pink-500/10 text-pink-500">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 w-full bg-white/5 rounded-full h-1.5">
              <div className="bg-pink-500 h-1.5 rounded-full" style={{ width: `${data.metrics.engagementScore}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/30 backdrop-blur-xl border-white/5">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Audience Atteinte (Reach)</p>
                <p className="text-3xl font-bold mt-2">{data.metrics.totalReach.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">sur {data.metrics.totalImpressions.toLocaleString()} impressions</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/30 backdrop-blur-xl border-white/5">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Temps de Vue Moyen</p>
                <p className="text-3xl font-bold mt-2">{data.metrics.avgViewTimeSec}s</p>
                <p className="text-xs text-muted-foreground mt-1">Max: {data.viewTimeStats.max}s</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/30 backdrop-blur-xl border-white/5">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Taux d'Attention (&gt;5s)</p>
                <p className="text-3xl font-bold mt-2">{data.metrics.attentionRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">Complétion: {data.metrics.completionRate}%</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                <Target className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/30 backdrop-blur-xl border-white/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Évolution du Taux d'Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAttention" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="attentionRate" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorAttention)" name="Taux attention (%)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/30 backdrop-blur-xl border-white/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Répartition de l'Audience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={audienceData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                  <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.8)" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Vues" barSize={32}>
                    {audienceData.map((entry, index) => (
                      <cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/30 backdrop-blur-xl border-white/5 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Impressions vs Reach (30 derniers jours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="impressions" stroke="#3b82f6" fillOpacity={1} fill="url(#colorImpressions)" name="Impressions" />
                  <Area type="monotone" dataKey="reach" stroke="#10b981" fillOpacity={1} fill="url(#colorReach)" name="Portée" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
