/**
 * pages/alerts/AlertsPage.tsx — Alert center
 * SmartVision IAD Dashboard
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, AlertCircle, Info, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-primary" aria-hidden="true" />
            Alert Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            System notifications, health warnings, and threshold alerts
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 px-3 py-1">
            {unackedCount} Unresolved
          </Badge>
          <Button variant="outline" className="gap-2 bg-card/50">
            <Filter className="h-4 w-4" /> Filter
          </Button>
        </div>
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
        {alerts.map((alert) => {
          const cfg = severityConfig[alert.severity];
          const Icon = cfg.icon;
          
          return (
            <motion.div key={alert.id} variants={item}>
              <Card className={cn("glass transition-colors", !alert.acknowledged ? `border-l-4 ${cfg.border.replace('border-', 'border-l-')}` : "opacity-70")}>
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-start">
                  
                  <div className={cn("shrink-0 h-10 w-10 rounded-full flex items-center justify-center", cfg.bg)}>
                    <Icon className={cn("h-5 w-5", cfg.color)} />
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        {alert.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        {alert.siteName && (
                          <Badge variant="outline" className="text-[10px] bg-secondary border-border font-normal">
                            {alert.siteName}
                          </Badge>
                        )}
                        {alert.deviceName && (
                          <Badge variant="outline" className="text-[10px] bg-secondary border-border font-normal">
                            {alert.deviceName}
                          </Badge>
                        )}
                      </h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                  
                  <div className="shrink-0 flex sm:flex-col gap-2 justify-end">
                    {!alert.acknowledged ? (
                      <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/50" onClick={() => handleAcknowledge(alert.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge
                      </Button>
                    ) : (
                      <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                      </span>
                    )}
                  </div>
                  
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {alerts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No active alerts.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
