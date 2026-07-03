import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSites } from '@/api/sites';
import { getDevices, deleteDevice } from '@/api/devices';
import { ThresholdsCard } from './ThresholdsCard';
import { DevicesTable } from './DevicesTable';
import { DeviceFormDialog } from './DeviceFormDialog';
import { DeleteDeviceDialog } from './DeleteDeviceDialog';
import { Button } from '@/components/ui/button';
import { Plus, Monitor, RefreshCw } from 'lucide-react';
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-medium">Chargement des agences...</p>
        </div>
      </div>
    );
  }

  if (sitesError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-4">
        <div className="text-center max-w-md border border-border bg-card p-8 rounded-xl shadow-lg">
          <p className="text-destructive font-medium mb-3">Impossible de charger les agences.</p>
          <p className="text-xs text-muted-foreground mb-4">
            Veuillez vérifier votre connexion au serveur ou vos droits d'accès.
          </p>
          <Button onClick={handleRefresh}>Réessayer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* ── Header & Site Selector ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Parc d'écrans & Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos dispositifs d'affichage (totems, bornes, écrans) et configurez les seuils comportementaux.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="site-select" className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Sélectionner une agence
            </label>
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger id="site-select" className="w-[220px] bg-card/50 glass">
                <SelectValue placeholder="Choisir un site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            className="h-9 w-9 shrink-0 mt-5 bg-card/50 glass"
            title="Rafraîchir les données"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {activeSite ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left panel: Site Thresholds (Takes 1 cols on large) */}
          <div className="lg:col-span-1">
            <ThresholdsCard site={activeSite} />
          </div>

          {/* Right panel: Devices Table (Takes 2 cols on large) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  Liste du parc d'écrans
                </h2>
                <p className="text-xs text-muted-foreground">
                  {devices.length} dispositif{devices.length > 1 ? 's' : ''} enregistré{devices.length > 1 ? 's' : ''}
                </p>
              </div>

              <Button onClick={handleAddClick} className="glow-primary font-medium gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                Ajouter un dispositif
              </Button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden shadow-lg bg-card">
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
        <div className="text-center py-12 border border-border border-dashed rounded-xl bg-card">
          <p className="text-muted-foreground text-sm">Veuillez sélectionner ou configurer une agence.</p>
        </div>
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
