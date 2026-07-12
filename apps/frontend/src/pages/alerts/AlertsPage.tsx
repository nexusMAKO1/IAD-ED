/**
 * pages/alerts/AlertsPage.tsx — Alert center
 * SmartVision IAD Dashboard
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, AlertCircle, Info, Filter, Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import type { AlertItem } from '@/types';

// Demo alerts removed; waiting for real alerts integration
const initialAlerts: AlertItem[] = [];

const severityConfig = {
  critical: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  warning:  { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  info:     { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
};

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0, transition: { duration: 0.3 } } };

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);

  const handleAcknowledge = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const unackedCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Centre d'alertes"
        description="Notifications système, avertissements et alertes de seuil"
        icon={AlertTriangle}
        iconColor="text-red-400"
        actions={
          <div className="flex items-center gap-3">
            {unackedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {unackedCount} non résolu{unackedCount > 1 ? 'es' : 'e'}
              </span>
            )}
            <Button variant="outline" size="sm" className="gap-2 hover:border-blue-500/40 hover:text-blue-400">
              <Filter className="h-3.5 w-3.5" /> Filtrer
            </Button>
          </div>
        }
      />

      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
        {alerts.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Aucune alerte active"
            description="Tout fonctionne normalement. Les alertes apparaîtront ici dès qu'un problème est détecté."
          />
        ) : alerts.map((alert) => {
          const cfg = severityConfig[alert.severity];
          const Icon = cfg.icon;
          return (
            <motion.div key={alert.id} variants={item}>
              <div className={cn(
                'glass-card p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-start transition-all',
                !alert.acknowledged && `border-l-4 border-l-current ${cfg.color}`,
                alert.acknowledged && 'opacity-60',
              )}>
                <div className={cn('shrink-0 h-9 w-9 rounded-xl flex items-center justify-center', cfg.bg, 'border', cfg.border)}>
                  <Icon className={cn('h-4 w-4', cfg.color)} />
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                    <h3 className="font-semibold text-sm text-foreground flex flex-wrap items-center gap-1.5">
                      {alert.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      {alert.siteName && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/30">{alert.siteName}</span>
                      )}
                      {alert.deviceName && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/30">{alert.deviceName}</span>
                      )}
                    </h3>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
                      {new Date(alert.timestamp).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
                <div className="shrink-0 flex sm:flex-col gap-2 justify-end">
                  {!alert.acknowledged ? (
                    <Button size="sm" variant="outline"
                      className="gap-1.5 h-7 text-[11px] hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/40"
                      onClick={() => handleAcknowledge(alert.id)}>
                      <CheckCircle2 className="h-3 w-3" /> Acquitter
                    </Button>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Résolu
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
