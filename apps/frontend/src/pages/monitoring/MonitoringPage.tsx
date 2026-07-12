/**
 * pages/monitoring/MonitoringPage.tsx — Infrastructure Monitoring
 * SmartVision IAD Dashboard — wired to real backend health endpoint + MQTT status
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Server, Database, Wifi, WifiOff, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { mqttClient } from '@/mqtt/mqtt.client';
import { useMqttConnectionStatus } from '@/mqtt/useMqtt';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface BackendHealth {
  status: 'ok' | 'error';
  info?: Record<string, { status: string }>;
  error?: Record<string, unknown>;
  details?: Record<string, { status: string }>;
}

function useBackendHealth() {
  return useQuery<BackendHealth>({
    queryKey: ['backendHealth'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/health`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 15_000,
    retry: 1,
  });
}

function StatusIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="w-4 h-4 rounded-full bg-muted-foreground/30" />;
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
    : <XCircle className="w-4 h-4 text-red-400" />;
}

export function MonitoringPage() {
  const mqttConnected = useMqttConnectionStatus();
  const { data: health, isLoading, isError, refetch, isFetching } = useBackendHealth();
  const [mqttPingMs, setMqttPingMs] = useState<number | null>(null);

  // Very rough MQTT round-trip estimate — counts how long since last incoming message
  useEffect(() => {
    let start = Date.now();
    const unsub = mqttClient.onConnectionChange((connected) => {
      if (connected) {
        setMqttPingMs(Date.now() - start);
        start = Date.now();
      }
    });
    return unsub;
  }, []);

  const backendOk = health?.status === 'ok';
  const services = health?.info
    ? Object.entries(health.info).map(([name, info]) => ({ name, status: info.status }))
    : [];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Supervision système"
        description="Santé du backend, état du broker MQTT et connectivité en temps réel"
        icon={Activity}
        actions={
          <Button variant="outline" size="sm" className="gap-2 hover:border-blue-500/40 hover:text-blue-400"
            onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Rafraîchir
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* MQTT */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <div className={`glass-card p-5 ${mqttConnected === 'connected' ? 'border-emerald-500/30' : 'border-red-500/25'}`}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Broker MQTT</p>
              {mqttConnected === 'connected'
                ? <Wifi className="h-4 w-4 text-emerald-400" />
                : <WifiOff className="h-4 w-4 text-red-400" />}
            </div>
            <p className={`text-2xl font-extrabold mb-1 ${mqttConnected === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>
              {mqttConnected === 'connected' ? 'Connecté' : 'Déconnecté'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {mqttConnected === 'connected'
                ? `WebSocket${mqttPingMs != null ? ` • ~${mqttPingMs}ms` : ''}`
                : 'Reconnexion automatique…'}
            </p>
          </div>
        </motion.div>

        {/* Backend */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
          <div className={`glass-card p-5 ${isError ? 'border-red-500/25' : backendOk ? 'border-emerald-500/30' : 'border-amber-500/25'}`}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Backend API</p>
              <Server className={`h-4 w-4 ${isError ? 'text-red-400' : backendOk ? 'text-emerald-400' : 'text-amber-400'}`} />
            </div>
            <p className={`text-2xl font-extrabold mb-1 ${isError ? 'text-red-400' : backendOk ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isLoading ? 'Vérification…' : isError ? 'Inaccessible' : backendOk ? 'Opérationnel' : 'Dégradé'}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">{API_URL}/health</p>
          </div>
        </motion.div>

        {/* Database */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Base de données</p>
              <Database className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-2xl font-extrabold mb-1 text-foreground">
              {isLoading ? '…' : (
                services.find(s => s.name.toLowerCase().includes('db') || s.name.toLowerCase().includes('postgres') || s.name.toLowerCase().includes('database'))?.status ?? 'N/A'
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">PostgreSQL / TimescaleDB</p>
          </div>
        </motion.div>
      </div>

      {/* Sub-service health */}
      {services.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border/40">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sous-services backend</p>
          </div>
          <div className="divide-y divide-border/25">
            {services.map(svc => (
              <div key={svc.name} className="flex items-center justify-between px-5 py-3 hover:bg-white/3 transition-colors">
                <span className="text-sm font-medium capitalize">{svc.name}</span>
                <div className="flex items-center gap-2">
                  <StatusIcon ok={svc.status === 'up'} />
                  <span className={`text-xs font-bold uppercase tabular-nums ${
                    svc.status === 'up' ? 'text-emerald-400' : 'text-red-400'
                  }`}>{svc.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CORS warning */}
      {isError && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Vérification de santé impossible depuis le frontend</p>
            <p className="text-xs mt-0.5 text-amber-400/80">
              L'endpoint <code className="font-mono">/health</code> peut nécessiter des headers CORS supplémentaires.
              Consultez <code className="font-mono">apps/frontend/TODO.md</code> pour les détails.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
