/**
 * pages/sites/SitesPage.tsx — Site management
 * SmartVision IAD Dashboard
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Monitor, Camera, MapPin, Plus, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSites } from '@/api/sites';
import { getDevices } from '@/api/devices';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { DensityGauge } from '@/components/charts/DensityGauge';
import { useMqttConnectionStatus } from '@/mqtt/useMqtt';
import { mqttClient } from '@/mqtt/mqtt.client';
import { MQTT_TOPICS } from '@/mqtt/mqtt.topics';
import { useToast } from '@/hooks/use-toast';
import type { Site } from '@/types';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } } };

export function SitesPage() {
  const isConnected = useMqttConnectionStatus();
  const { toast } = useToast();
  const [deviceStatusMap, setDeviceStatusMap] = useState<Record<string, 'ONLINE' | 'OFFLINE' | 'DEGRADED'>>({});

  const { data: sites = [], isLoading, isError } = useQuery({
    queryKey: ['sites'],
    queryFn: getSites,
  });

  // Fetch all devices (for all sites) to get counts
  // We only query once sites are loaded
  const { data: allDevices = [] } = useQuery({
    queryKey: ['devices', 'all'],
    queryFn: () => getDevices(''),  // all devices
    enabled: sites.length > 0,
    retry: 1,
  });

  // Count devices per site
  const deviceCountBySite = React.useMemo(() => {
    const map: Record<string, number> = {};
    (allDevices as any[]).forEach((d: any) => {
      if (d.siteId) map[d.siteId] = (map[d.siteId] || 0) + 1;
    });
    return map;
  }, [allDevices]);

  // MQTT: subscribe to system/health for live device status updates
  useEffect(() => {
    const unsub = mqttClient.subscribe(
      MQTT_TOPICS.SYSTEM.HEALTH,
      (_topic, envelope) => {
        const payload = envelope.payload as Record<string, unknown>;
        const deviceId = envelope.deviceId;
        const status = (payload?.['status'] as string)?.toUpperCase();
        if (deviceId && (status === 'ONLINE' || status === 'OFFLINE' || status === 'DEGRADED')) {
          setDeviceStatusMap(prev => ({ ...prev, [deviceId]: status as 'ONLINE' | 'OFFLINE' | 'DEGRADED' }));
        }
      },
    );
    return unsub;
  }, []);

  if (isError) {
    return (
      <div className="p-8 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>Impossible de charger les sites. Vérifiez votre connexion au serveur.</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-6"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
            Gestion des sites
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d'ensemble de tous les sites déployés et leur statut actuel
          </p>
        </div>
        <Button className="glow-primary" disabled title="POST /api/v1/sites non implémenté — voir TODO.md">
          <Plus className="h-4 w-4 mr-2" /> Ajouter un site
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site: Site) => (
            <motion.div key={site.id} variants={item}>
              <Card className="glass-card h-full flex flex-col hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{site.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {site.address}
                      </CardDescription>
                    </div>
                    <StatusBadge status="ONLINE" size="sm" />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Appareils</p>
                      <p className="text-2xl font-bold">
                        {deviceCountBySite[site.id] ?? 0}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Seuil densité</p>
                      <p className="text-2xl font-bold text-muted-foreground">
                        {(site as any).densityThreshold ?? '--'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{deviceCountBySite[site.id] ?? 0}</span> Appareils
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 border-t border-border/50 mt-4 flex gap-2">
                  <Button variant="ghost" className="w-full justify-center text-primary hover:text-primary hover:bg-primary/10">
                    Voir les détails
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
