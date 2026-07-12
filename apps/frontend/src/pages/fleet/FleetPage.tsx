import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSites } from '@/api/sites';
import { getDevices, deleteDevice } from '@/api/devices';
import { ThresholdsCard } from './ThresholdsCard';
import { DevicesTable } from './DevicesTable';
import { DeviceFormDialog } from './DeviceFormDialog';
import { DeleteDeviceDialog } from './DeleteDeviceDialog';
import { Button } from '@/components/ui/button';
import { Plus, Monitor, RefreshCw, MonitorPlay } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Device } from '@/types';
import { getErrorMessage } from '@/types';

export function FleetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSiteId, setSelectedSiteId] = React.useState<string>('');
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [activeDevice, setActiveDevice] = React.useState<Device | null>(null);

  // ─── Fetch Sites ───────────────────────────────────────────────────────────
  const {
    data: sites = [],
    isLoading: isSitesLoading,
    error: sitesError,
    refetch: refetchSites,
  } = useQuery({
    queryKey: ['sites'],
    queryFn: getSites,
  });

  // Set default site when list loaded
  React.useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const activeSite = sites.find((s) => s.id === selectedSiteId);

  // ─── Fetch Devices for selected Site ───────────────────────────────────────
  const {
    data: devices = [],
    isLoading: isDevicesLoading,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: ['devices', selectedSiteId],
    queryFn: () => getDevices(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  // ─── Delete Device Mutation ────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', selectedSiteId] });
      toast({
        variant: 'success',
        title: 'Dispositif supprimé',
        description: `Le dispositif a été retiré du parc avec succès.`,
      });
      setIsDeleteOpen(false);
      setActiveDevice(null);
    },
    onError: (error: unknown) => {
      toast({
        variant: 'destructive',
        title: 'Erreur de suppression',
        description: getErrorMessage(error, 'Une erreur est survenue lors de la suppression.'),
      });
    },
  });

  // Handlers
  const handleAddClick = () => {
    setActiveDevice(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (device: Device) => {
    setActiveDevice(device);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (device: Device) => {
    setActiveDevice(device);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    if (activeDevice) {
      deleteMutation.mutate(activeDevice.id);
    }
  };

  const handleRefresh = () => {
    refetchSites();
    if (selectedSiteId) {
      refetchDevices();
    }
  };

  if (isSitesLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500/40 border-t-blue-500 animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Chargement des sites…</p>
        </div>
      </div>
    );
  }

  if (sitesError) {
    return (
      <div className="p-8">
        <ErrorState onRetry={handleRefresh} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Parc d'appareils"
        description="Gérez vos dispositifs d'affichage et configurez les seuils comportementaux par site."
        icon={MonitorPlay}
        actions={
          <div className="flex items-center gap-2">
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger id="site-select" className="w-[200px]">
                <SelectValue placeholder="Choisir un site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleRefresh} title="Rafraîchir">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {activeSite ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1">
            <ThresholdsCard site={activeSite} />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-blue-400" />
                  Appareils — {activeSite.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {devices.length} dispositif{devices.length !== 1 ? 's' : ''} enregistré{devices.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button onClick={handleAddClick} className="gradient-bg-blue border-0 text-white glow-primary gap-1.5">
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </div>
            <div className="glass-card overflow-hidden">
              <DevicesTable
                devices={devices}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                isLoading={isDevicesLoading}
              />
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={MonitorPlay}
          title="Sélectionnez un site"
          description="Choisissez un site dans la liste ci-dessus pour gérer ses appareils."
        />
      )}

      {/* ── Dialog Modals ────────────────────────────────────────────────────── */}
      <DeviceFormDialog
        device={activeDevice}
        siteId={selectedSiteId}
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
      />

      <DeleteDeviceDialog
        device={activeDevice}
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
