import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDevice, updateDevice } from '@/api/devices';
import type { Device, DeviceType, DeviceStatus, ApiValidationError } from '@/types';
import { extractFieldErrors, getErrorMessage } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface DeviceFormDialogProps {
  device: Device | null; // null for creation mode, Device for edit mode
  siteId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeviceFormDialog({
  device,
  siteId,
  isOpen,
  onOpenChange,
}: DeviceFormDialogProps) {
  const isEditMode = !!device;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<DeviceType>('TOTEM');
  const [ipAddress, setIpAddress] = React.useState('');
  const [status, setStatus] = React.useState<DeviceStatus>('OFFLINE');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (isOpen) {
      if (device) {
        setName(device.name);
        setType(device.type);
        setIpAddress(device.ipAddress || '');
        setStatus(device.status);
      } else {
        setName('');
        setType('TOTEM');
        setIpAddress('');
        setStatus('OFFLINE');
      }
      setFieldErrors({});
    }
  }, [isOpen, device]);

  const mutation = useMutation({
    mutationFn: async (variables: {
      name: string;
      type: DeviceType;
      ipAddress?: string;
      status?: DeviceStatus;
    }) => {
      if (isEditMode && device) {
        return updateDevice(device.id, {
          name: variables.name,
          type: variables.type,
          ipAddress: variables.ipAddress || undefined,
          status: variables.status,
        });
      } else {
        return createDevice({
          name: variables.name,
          type: variables.type,
          ipAddress: variables.ipAddress || undefined,
          siteId,
        });
      }
    },
    onSuccess: (savedDevice) => {
      queryClient.invalidateQueries({ queryKey: ['devices', siteId] });
      toast({
        variant: 'success',
        title: isEditMode ? 'Dispositif mis à jour' : 'Dispositif créé',
        description: `Le dispositif ${savedDevice.name} a été enregistré avec succès.`,
      });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      if (error && typeof error === 'object' && 'message' in error) {
        const errors = extractFieldErrors(error as ApiValidationError);
        setFieldErrors(errors);
      }
      toast({
        variant: 'destructive',
        title: "Erreur d'enregistrement",
        description: getErrorMessage(error, "Une erreur est survenue lors de l'enregistrement."),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name,
      type,
      ipAddress: ipAddress.trim() || undefined,
      status: isEditMode ? status : undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Modifier le dispositif' : 'Ajouter un dispositif'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Mettez à jour les informations du dispositif ou modifiez son statut réseau.'
              : 'Saisissez les informations pour enregistrer un nouvel écran ou totem sur ce site.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div className="space-y-1">
            <Label htmlFor="device-name">Nom du dispositif</Label>
            <Input
              id="device-name"
              placeholder="ex: Totem Entrée, Écran Salle d'attente"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, name: '' }));
              }}
              error={fieldErrors.name}
              required
            />
          </div>

          {/* Type Selector */}
          <div className="space-y-1">
            <Label htmlFor="device-type">Type de dispositif</Label>
            <Select
              value={type}
              onValueChange={(val: DeviceType) => {
                setType(val);
                setFieldErrors((prev) => ({ ...prev, type: '' }));
              }}
            >
              <SelectTrigger id="device-type">
                <SelectValue placeholder="Sélectionnez un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TOTEM">Totem</SelectItem>
                <SelectItem value="WAITING_ROOM_SCREEN">Écran Salle d'attente</SelectItem>
                <SelectItem value="TICKET_KIOSK">Borne Ticket</SelectItem>
                <SelectItem value="SCREEN">Écran (Standard)</SelectItem>
                <SelectItem value="KIOSK">Borne (Standard)</SelectItem>
                <SelectItem value="CAMERA">Caméra de détection</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.type && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.type}</p>
            )}
          </div>

          {/* IP Address Field */}
          <div className="space-y-1">
            <Label htmlFor="device-ip">Adresse IP (Optionnelle)</Label>
            <Input
              id="device-ip"
              placeholder="ex: 192.168.1.100"
              value={ipAddress}
              onChange={(e) => {
                setIpAddress(e.target.value);
                setFieldErrors((prev) => ({ ...prev, ipAddress: '' }));
              }}
              error={fieldErrors.ipAddress}
            />
            <p className="text-[10px] text-muted-foreground">
              Optionnel. Doit être une adresse IPv4 ou IPv6 valide.
            </p>
          </div>

          {/* Status (Edit Mode Only) */}
          {isEditMode && (
            <div className="space-y-1">
              <Label htmlFor="device-status">Forcer le statut réseau</Label>
              <Select
                value={status}
                onValueChange={(val: DeviceStatus) => {
                  setStatus(val);
                  setFieldErrors((prev) => ({ ...prev, status: '' }));
                }}
              >
                <SelectTrigger id="device-status">
                  <SelectValue placeholder="Sélectionnez un statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONLINE">En Ligne (Online)</SelectItem>
                  <SelectItem value="DEGRADED">Dégradé (Degraded)</SelectItem>
                  <SelectItem value="OFFLINE">Hors Ligne (Offline)</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.status && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.status}</p>
              )}
            </div>
          )}

          {fieldErrors._general && (
            <p className="text-sm text-destructive font-medium mt-2">{fieldErrors._general}</p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="glow-primary">
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
