/**
 * pages/sites/SitesPage.tsx — Premium site management
 * IAD SmartVision Dashboard — Blue/Cyan enterprise theme
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Plus, Monitor, Edit2, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { getSites, deleteSite } from '@/api/sites';
import { getDevices } from '@/api/devices';
import { mqttClient } from '@/mqtt/mqtt.client';
import { MQTT_TOPICS } from '@/mqtt/mqtt.topics';
import { useToast } from '@/hooks/use-toast';
import { SiteFormDialog } from './SiteFormDialog';
import { DeleteSiteDialog } from './DeleteSiteDialog';
import type { Site } from '@/types';
import { getErrorMessage } from '@/types';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22,1,0.36,1] } } };

export function SitesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deviceStatusMap, setDeviceStatusMap] = useState<Record<string, 'ONLINE'|'OFFLINE'|'DEGRADED'>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [activeSite, setActiveSite] = useState<Site | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: sites = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['sites'],
    queryFn: getSites,
  });

  const { data: allDevices = [] } = useQuery({
    queryKey: ['devices', 'all'],
    queryFn: () => getDevices(),
    enabled: sites.length > 0,
    retry: 1,
  });

  const deviceCountBySite = React.useMemo(() => {
    const map: Record<string, number> = {};
    (allDevices as any[]).forEach((d: any) => {
      if (d.siteId) map[d.siteId] = (map[d.siteId] || 0) + 1;
    });
    return map;
  }, [allDevices]);

  useEffect(() => {
    const unsub = mqttClient.subscribe(MQTT_TOPICS.SYSTEM.HEALTH, (_t, env) => {
      const payload = env.payload as Record<string, unknown>;
      const deviceId = env.deviceId;
      const status = (payload?.['status'] as string)?.toUpperCase();
      if (deviceId && (status === 'ONLINE' || status === 'OFFLINE' || status === 'DEGRADED')) {
        setDeviceStatusMap(prev => ({ ...prev, [deviceId]: status as any }));
      }
    });
    return unsub;
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      toast({ variant: 'success', title: 'Site supprimé', description: 'Le site a été supprimé avec succès.' });
      setIsDeleteOpen(false);
      setActiveSite(null);
      setDeleteError(null);
    },
    onError: (error: unknown) => {
      setDeleteError(getErrorMessage(error, 'Impossible de supprimer ce site.'));
    },
  });

  const filteredSites = sites.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Gestion des sites"
        description="Vue d'ensemble de tous vos sites déployés et leur statut en temps réel"
        icon={Building2}
        actions={
          <Button onClick={() => { setActiveSite(null); setIsFormOpen(true); }}
            className="gradient-bg-blue border-0 text-white glow-primary gap-2">
            <Plus className="h-4 w-4" /> Ajouter un site
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Rechercher un site…"
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Content */}
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      ) : filteredSites.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aucun site trouvé"
          description={searchQuery ? 'Aucun résultat pour votre recherche.' : 'Commencez par ajouter votre premier site.'}
          action={!searchQuery ? (
            <Button onClick={() => { setActiveSite(null); setIsFormOpen(true); }}
              className="gradient-bg-blue border-0 text-white gap-2">
              <Plus className="h-4 w-4" /> Ajouter un site
            </Button>
          ) : undefined}
        />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSites.map((site: Site) => (
            <motion.div key={site.id} variants={item}>
              <div className="glass-card h-full flex flex-col overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
                {/* Card accent header */}
                <div className="h-1 w-full gradient-bg-blue opacity-60 group-hover:opacity-100 transition-opacity" />

                <div className="p-5 flex-1 flex flex-col gap-4">
                  {/* Site name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{site.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{site.address}</span>
                      </p>
                    </div>
                    <StatusBadge status="ONLINE" size="sm" />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-500/6 border border-blue-500/15 rounded-xl p-3 text-center">
                      <p className="text-2xl font-extrabold text-foreground">{deviceCountBySite[site.id] ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">
                        <Monitor className="h-3 w-3" /> Appareils
                      </p>
                    </div>
                    <div className="bg-muted/30 border border-border/30 rounded-xl p-3 text-center">
                      <p className="text-2xl font-extrabold text-muted-foreground">
                        {(site as any).densityThreshold ?? '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Seuil densité</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto pt-2 border-t border-border/30">
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5 hover:border-blue-500/40 hover:text-blue-400"
                      onClick={() => { setActiveSite(site); setIsFormOpen(true); }}>
                      <Edit2 className="h-3 w-3" /> Modifier
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5 hover:border-red-500/40 hover:text-red-400"
                      onClick={() => { setActiveSite(site); setDeleteError(null); setIsDeleteOpen(true); }}>
                      <Trash2 className="h-3 w-3" /> Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <SiteFormDialog site={activeSite} isOpen={isFormOpen} onOpenChange={setIsFormOpen} />
      <DeleteSiteDialog
        site={activeSite} isOpen={isDeleteOpen}
        onOpenChange={(open) => { if (!open) setDeleteError(null); setIsDeleteOpen(open); }}
        onConfirm={() => activeSite && deleteMutation.mutate(activeSite.id)}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteError}
      />
    </div>
  );
}
