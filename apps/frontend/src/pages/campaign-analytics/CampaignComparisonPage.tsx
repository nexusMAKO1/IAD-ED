import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronsUpDown, AlertCircle, BarChart2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { campaignAnalyticsApi } from '@/api/campaignAnalytics';
import { PerformanceGrade } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

export const CampaignComparisonPage = () => {
  // In a real app, you'd use a multi-select dropdown. 
  // For this implementation, we'll fetch the top 5 campaigns to compare automatically,
  // or allow comparing all active ones. We'll use the leaderboard query to get campaigns.
  const { data: leaderboard, isLoading: isLoadingList } = useQuery({
    queryKey: ['campaignLeaderboard'],
    queryFn: campaignAnalyticsApi.getLeaderboard,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const { data: comparisonData, isLoading: isLoadingComparison } = useQuery({
    queryKey: ['campaignComparison', selectedIds],
    queryFn: () => campaignAnalyticsApi.getComparison(selectedIds),
    enabled: selectedIds.length > 0,
  });

  const chartData = comparisonData?.map(c => ({
    name: c.campaignName.length > 15 ? c.campaignName.substring(0, 15) + '...' : c.campaignName,
    'Score Global': c.performanceScore,
    'Taux Attention (%)': c.attentionRate,
    'Taux Complétion (%)': c.completionRate,
  })) || [];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link to="/campaigns/performance">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <PageHeader
          title="Comparaison de Campagnes"
          description="Analysez les performances côte à côte pour identifier les meilleures pratiques."
        />
      </div>

      <Card className="bg-card/30 backdrop-blur-xl border-white/5">
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Sélectionnez les campagnes à comparer (max 5)</h3>
          <div className="flex flex-wrap gap-2">
            {isLoadingList ? (
              <div className="animate-pulse h-8 w-32 bg-white/10 rounded-md"></div>
            ) : (
              leaderboard?.map(c => (
                <button
                  key={c.campaignId}
                  onClick={() => toggleSelection(c.campaignId)}
                  disabled={!selectedIds.includes(c.campaignId) && selectedIds.length >= 5}
                  className={`px-4 py-2 text-sm rounded-full border transition-all ${
                    selectedIds.includes(c.campaignId)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white/5 border-white/10 hover:border-white/30 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {c.campaignName}
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {selectedIds.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5">
          <BarChart2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Sélectionnez au moins une campagne pour afficher la comparaison.</p>
        </div>
      ) : isLoadingComparison ? (
        <div className="flex py-20 items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/30 backdrop-blur-xl border-white/5">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-6">Comparaison des Scores</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      />
                      <Legend />
                      <Bar dataKey="Score Global" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Taux Attention (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Taux Complétion (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/30 backdrop-blur-xl border-white/5">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-6">Métrique : Impressions & Reach</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground bg-white/5 border-b border-white/5">
                      <tr>
                        <th className="px-4 py-3 font-medium">Campagne</th>
                        <th className="px-4 py-3 font-medium">Impressions</th>
                        <th className="px-4 py-3 font-medium">Reach</th>
                        <th className="px-4 py-3 font-medium">Ratio Reach/Imp.</th>
                        <th className="px-4 py-3 font-medium">Temps Moyen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {comparisonData?.map((c) => (
                        <tr key={c.campaignId} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 font-medium text-white">{c.campaignName}</td>
                          <td className="px-4 py-3">{c.impressions.toLocaleString()}</td>
                          <td className="px-4 py-3 text-emerald-400">{c.reach.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            {c.impressions > 0 ? Math.round((c.reach / c.impressions) * 100) : 0}%
                          </td>
                          <td className="px-4 py-3 text-amber-400">{c.avgViewTimeSec}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
          
        </motion.div>
      )}
    </div>
  );
};
