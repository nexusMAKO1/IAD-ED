/**
 * pages/monitoring/MonitoringPage.tsx — Infrastructure Monitoring
 * SmartVision IAD Dashboard
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Server, Database, Network, Cpu, MemoryStick } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/dashboard/StatusBadge';

// Demo services removed; waiting for real monitoring API integration
const services: any[] = [];

export function MonitoringPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" aria-hidden="true" />
            System Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Infrastructure health, backend services, and MQTT broker status
          </p>
        </div>
      </motion.div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border/50 rounded-xl bg-secondary/5 text-muted-foreground">
          <Activity className="h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">No monitoring data available</h3>
          <p className="text-sm mt-1">Waiting for system telemetry...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((srv, i) => (
            <motion.div
              key={srv.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass h-full">
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-medium">{srv.name}</CardTitle>
                    <span className="text-[10px] text-muted-foreground uppercase">{srv.type}</span>
                  </div>
                  <StatusBadge status={srv.status} size="sm" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Cpu className="h-3.5 w-3.5" /> CPU
                      </span>
                      <span className={`font-mono ${srv.cpu > 80 ? 'text-amber-400 font-bold' : ''}`}>{srv.cpu}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${srv.cpu > 80 ? 'bg-amber-400' : 'bg-primary'}`} style={{ width: `${srv.cpu}%` }} />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">Memory</span>
                    <span className="font-mono">{srv.memory} MB</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Uptime</span>
                    <span className="font-mono">{srv.uptime}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
