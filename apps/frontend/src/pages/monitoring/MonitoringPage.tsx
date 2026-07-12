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
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" aria-hidden="true" />
            Supervision système
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Santé du backend, état du broker MQTT et connectivité en temps réel
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Rafraîchir
        </Button>
      </motion.div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* MQTT */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className={`glass border ${mqttConnected ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Broker MQTT</CardTitle>
              {mqttConnected
                ? <Wifi className="h-5 w-5 text-emerald-400" />
                : <WifiOff className="h-5 w-5 text-red-400" />}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold mb-1 ${mqttConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                {mqttConnected ? 'Connecté' : 'Déconnecté'}
              </div>
              <p className="text-xs text-muted-foreground">
                {mqttConnected
                  ? `WebSocket • ws://localhost:9003${mqttPingMs != null ? ` • ~${mqttPingMs}ms` : ''}`
                  : 'Reconnexion automatique en cours…'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Backend */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className={`glass border ${isError ? 'border-red-500/30' : backendOk ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Backend API</CardTitle>
              <Server className={`h-5 w-5 ${isError ? 'text-red-400' : backendOk ? 'text-emerald-400' : 'text-amber-400'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold mb-1 ${isError ? 'text-red-400' : backendOk ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isLoading ? 'Vérification…' : isError ? 'Inaccessible' : backendOk ? 'Opérationnel' : 'Dégradé'}
              </div>
              <p className="text-xs text-muted-foreground">
                {isError
                  ? 'CORS ou serveur hors ligne — voir TODO.md'
                  : `GET ${API_URL}/health`}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Database (from health info) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Card className="glass">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Base de données</CardTitle>
              <Database className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-1">
                {isLoading ? '…' : (services.find(s => s.name.toLowerCase().includes('db') || s.name.toLowerCase().includes('postgres') || s.name.toLowerCase().includes('database'))?.status ?? 'N/A')}
              </div>
              <p className="text-xs text-muted-foreground">PostgreSQL / TimescaleDB</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Sub-service health */}
      {services.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Sous-services backend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {services.map(svc => (
                <div key={svc.name} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium capitalize">{svc.name}</span>
                  <div className="flex items-center gap-2">
                    <StatusIcon ok={svc.status === 'up'} />
                    <span className={`text-xs font-semibold uppercase ${svc.status === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {svc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
