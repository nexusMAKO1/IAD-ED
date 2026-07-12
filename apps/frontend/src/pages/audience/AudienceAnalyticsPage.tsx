/**
 * pages/audience/AudienceAnalyticsPage.tsx — Demographics & audience analytics
 * SmartVision IAD Dashboard
 */

import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Clock, Star, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { DemographicsPieChart } from '@/components/charts/DemographicsPieChart';
import { AgeBarChart, GenderHourChart } from '@/components/charts/AgeBarChart';
import { VisitorLineChart } from '@/components/charts/VisitorLineChart';

type OutletCtx = { selectedSiteId: string };

// Demo demographics data removed; waiting for real API integration

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export function AudienceAnalyticsPage() {
  const { selectedSiteId } = useOutletContext<OutletCtx>();

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
          Audience Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Demographics, behavior patterns, and audience composition
        </p>
      </motion.div>

      {/* Summary KPIs */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={item}><KpiCard title="Returning Visitors" value="--" icon={Star} color="muted" trend="neutral" trendLabel="No data available" /></motion.div>
        <motion.div variants={item}><KpiCard title="New Visitors" value="--" icon={Users} color="muted" trend="neutral" trendLabel="No data available" /></motion.div>
        <motion.div variants={item}><KpiCard title="Peak Hour" value="--" icon={Clock} color="muted" trend="neutral" trendLabel="No data available" /></motion.div>
        <motion.div variants={item}><KpiCard title="Peak Count" value="0" icon={TrendingUp} color="muted" trend="neutral" trendLabel="No data available" /></motion.div>
      </motion.div>

      {/* Charts Grid */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gender Pie */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Gender Split</CardTitle>
            </CardHeader>
            <CardContent>
              <DemographicsPieChart data={[]} height={240} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Age Distribution */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Age Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <AgeBarChart data={[]} height={240} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Gender by Hour */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Gender by Hour</CardTitle>
            </CardHeader>
            <CardContent>
              <GenderHourChart data={[]} height={240} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Returning Visitors */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Returning Visitors — 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <VisitorLineChart data={[]} useArea color="#ec4899" height={240} />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
