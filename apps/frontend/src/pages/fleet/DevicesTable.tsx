import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, Monitor, HelpCircle, HardDrive, Cpu, AlertTriangle } from 'lucide-react';
import type { Device, DeviceType, DeviceStatus } from '@/types';

interface DevicesTableProps {
  devices: Device[];
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  isLoading: boolean;
}

function getTypeBadgeVariant(type: DeviceType) {
  switch (type) {
    case 'TOTEM':
      return 'totem';
    case 'WAITING_ROOM_SCREEN':
    case 'SCREEN':
      return 'screen';
    case 'TICKET_KIOSK':
    case 'KIOSK':
      return 'kiosk';
    case 'CAMERA':
      return 'camera';
    default:
      return 'default';
  }
}

function getTypeLabel(type: DeviceType) {
  switch (type) {
    case 'TOTEM':
      return 'Totem';
    case 'WAITING_ROOM_SCREEN':
      return 'Écran Salle Attente';
    case 'TICKET_KIOSK':
      return 'Borne Ticket';
    case 'SCREEN':
      return 'Écran Standard';
    case 'KIOSK':
      return 'Borne Standard';
    case 'CAMERA':
      return 'Caméra';
    default:
      return type;
  }
}

function getTypeIcon(type: DeviceType) {
  switch (type) {
    case 'TOTEM':
      return <Cpu className="h-3.5 w-3.5 mr-1 shrink-0" />;
    case 'WAITING_ROOM_SCREEN':
    case 'SCREEN':
      return <Monitor className="h-3.5 w-3.5 mr-1 shrink-0" />;
    case 'TICKET_KIOSK':
    case 'KIOSK':
      return <HardDrive className="h-3.5 w-3.5 mr-1 shrink-0" />;
    default:
      return <HelpCircle className="h-3.5 w-3.5 mr-1 shrink-0" />;
  }
}

function getStatusBadgeVariant(status: DeviceStatus) {
  switch (status) {
    case 'ONLINE':
      return 'online';
    case 'OFFLINE':
      return 'offline';
    case 'DEGRADED':
      return 'degraded';
    default:
      return 'default';
  }
}

function getStatusLabel(status: DeviceStatus) {
  switch (status) {
    case 'ONLINE':
      return 'En Ligne';
    case 'OFFLINE':
      return 'Hors Ligne';
    case 'DEGRADED':
      return 'Dégradé';
    default:
      return status;
  }
}

export function DevicesTable({ devices, onEdit, onDelete, isLoading }: DevicesTableProps) {
  if (isLoading) {
    return (
      <div className="w-full flex justify-center items-center py-12 border border-border rounded-xl bg-card">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement du parc d'écrans...</p>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 border border-border border-dashed rounded-xl bg-card/50 text-center px-4">
        <Monitor className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <h4 className="text-lg font-semibold mb-1">Aucun écran enregistré</h4>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          Il n'y a aucun dispositif enregistré sur ce site pour le moment. Cliquez sur le bouton d'ajout pour commencer.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-semibold">Nom du dispositif</TableHead>
          <TableHead className="font-semibold">Type</TableHead>
          <TableHead className="font-semibold">Adresse IP</TableHead>
          <TableHead className="font-semibold">Statut réseau</TableHead>
          <TableHead className="font-semibold text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {devices.map((device) => (
          <TableRow key={device.id} className="group">
            {/* Name */}
            <TableCell className="font-medium text-foreground">
              {device.name}
            </TableCell>

            {/* Type */}
            <TableCell>
              <Badge variant={getTypeBadgeVariant(device.type)} className="inline-flex items-center">
                {getTypeIcon(device.type)}
                {getTypeLabel(device.type)}
              </Badge>
            </TableCell>

            {/* IP Address */}
            <TableCell className="font-mono text-xs text-muted-foreground">
              {device.ipAddress || '—'}
            </TableCell>

            {/* Status */}
            <TableCell>
              <Badge variant={getStatusBadgeVariant(device.status)}>
                {device.status === 'DEGRADED' && <AlertTriangle className="h-3 w-3 mr-1 shrink-0 animate-pulse text-amber-300" />}
                {getStatusLabel(device.status)}
              </Badge>
            </TableCell>

            {/* Actions */}
            <TableCell className="text-right">
              <div className="flex justify-end gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => onEdit(device)}
                >
                  <Edit2 className="h-4 w-4" />
                  <span className="sr-only">Modifier</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(device)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Supprimer</span>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
