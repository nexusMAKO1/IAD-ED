import { useState } from 'react';
import { motion } from 'framer-motion';
import { MonitorPlay, RefreshCw, Settings, Trash2, Unlink, Plus, Cpu, Clock, MapPin, CheckCircle2, AlertTriangle, MonitorOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDisplayDevices, unpairDisplayDevice, removeDisplayDevice } from '@/api/display-devices';
import { getSites } from '@/api/sites';
import { useToast } from '@/hooks/use-toast';
import { PairDisplayModal } from './PairDisplayModal';
import { cn } from '@/lib/utils';

const stagger: any = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const item: any = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22,1,0.36,1] } } };

type TabType = 'UNPAIRED' | 'ONLINE' | 'OFFLINE';

export function DisplaysPage() {
  const [activeTab, setActiveTab] = useState<TabType>('UNPAIRED');
  const [pairingDevice, setPairingDevice] = useState<any | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: displays = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['displays'],
    queryFn: () => getDisplayDevices(),
    refetchInterval: 3000, // Real-time polling
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: () => getSites(),
  });

  const unpairMutation = useMutation({
    mutationFn: (id: string) => unpairDisplayDevice(id),
    onSuccess: () => {
      toast({ title: 'Afficheur dissocié avec succès', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['displays'] });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la dissociation', variant: 'destructive' });
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeDisplayDevice(id),
    onSuccess: () => {
      toast({ title: 'Afficheur supprimé', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['displays'] });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  });

  const filteredDisplays = displays.filter((d: any) => {
    if (activeTab === 'UNPAIRED') return d.status === 'UNPAIRED';
    if (activeTab === 'ONLINE') return d.status === 'ONLINE';
    if (activeTab === 'OFFLINE') return d.status === 'OFFLINE' || d.status === 'DEGRADED';
    return true;
  });

  const counts = {
    unpaired: displays.filter((d: any) => d.status === 'UNPAIRED').length,
    online: displays.filter((d: any) => d.status === 'ONLINE').length,
    offline: displays.filter((d: any) => d.status === 'OFFLINE' || d.status === 'DEGRADED').length,
  };

  const tabs: { id: TabType; label: string; count: number; icon: any; color: string }[] = [
    { id: 'UNPAIRED', label: 'Nouveaux Afficheurs', count: counts.unpaired, icon: AlertTriangle, color: 'text-amber-400' },
    { id: 'ONLINE', label: 'En Ligne', count: counts.online, icon: CheckCircle2, color: 'text-emerald-400' },
    { id: 'OFFLINE', label: 'Hors Ligne', count: counts.offline, icon: MonitorOff, color: 'text-slate-400' },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Gestion des Afficheurs"
        description="Découverte automatique, provisioning et supervision de vos écrans"
        icon={MonitorPlay}
        actions={
          <Button variant="outline" size="sm" className="gap-2 hover:border-blue-500/40 hover:text-blue-400" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-900/50 border border-border/30 rounded-xl max-w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === tab.id
                ? "bg-slate-800 text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <tab.icon className={cn("h-4 w-4", tab.color)} />
            {tab.label}
            <span className={cn(
              "ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
              activeTab === tab.id ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-400"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      ) : filteredDisplays.length === 0 ? (
        <EmptyState
          icon={MonitorPlay}
          title={`Aucun afficheur ${activeTab.toLowerCase()}`}
          description={
            activeTab === 'UNPAIRED'
              ? "Branchez un nouvel écran sur le réseau. Il apparaîtra automatiquement ici."
              : "Aucun écran dans cette catégorie pour le moment."
          }
        />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredDisplays.map((display: any) => (
            <motion.div key={display.id} variants={item} className="glass-card overflow-hidden flex flex-col group hover:border-blue-500/30 transition-all duration-300">
              
              <div className="p-5 flex-1 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 shadow-lg",
                      display.status === 'ONLINE' ? "bg-emerald-500/10 ring-emerald-500/30 text-emerald-400" :
                      display.status === 'UNPAIRED' ? "bg-amber-500/10 ring-amber-500/30 text-amber-400" :
                      "bg-slate-500/10 ring-slate-500/30 text-slate-400"
                    )}>
                      <MonitorPlay className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-foreground tracking-tight flex items-center gap-2">
                        {display.deviceId}
                        {display.status === 'UNPAIRED' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 uppercase">Nouveau</span>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {display.site ? display.site.name : 'Aucun site assigné'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={display.status} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-border/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Cpu className="h-3.5 w-3.5" />
                      <span className="uppercase tracking-wider text-[10px]">Système</span>
                    </div>
                    <p className="font-medium text-foreground truncate">{display.platform} • {display.version}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-border/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="uppercase tracking-wider text-[10px]">Réseau</span>
                    </div>
                    <p className="font-medium text-foreground truncate">{display.ip} • {display.hostname}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-border/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <MonitorPlay className="h-3.5 w-3.5" />
                      <span className="uppercase tracking-wider text-[10px]">Résolution</span>
                    </div>
                    <p className="font-medium text-foreground truncate">{display.resolution}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-border/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="uppercase tracking-wider text-[10px]">Dernier ping</span>
                    </div>
                    <p className="font-medium text-foreground truncate">{new Date(display.lastSeen).toLocaleTimeString('fr-FR')}</p>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="px-5 py-3 border-t border-border/30 bg-slate-900/30 flex items-center justify-end gap-2">
                {display.status === 'UNPAIRED' ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate(display.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-8 text-xs">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Ignorer
                    </Button>
                    <Button size="sm" onClick={() => setPairingDevice(display)} className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Associer au site
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => unpairMutation.mutate(display.id)} className="h-8 text-xs hover:border-amber-500/40 hover:text-amber-400">
                      <Unlink className="h-3.5 w-3.5 mr-1.5" /> Dissocier
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs hover:border-blue-500/40 hover:text-blue-400">
                      <Settings className="h-3.5 w-3.5 mr-1.5" /> Paramètres
                    </Button>
                  </>
                )}
              </div>

            </motion.div>
          ))}
        </motion.div>
      )}

      {pairingDevice && (
        <PairDisplayModal
          device={pairingDevice}
          sites={sites}
          isOpen={!!pairingDevice}
          onClose={() => setPairingDevice(null)}
          onSuccess={() => {
            setPairingDevice(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
