/**
 * pages/cameras/CamerasPage.tsx — Premium camera fleet monitoring
 * IAD SmartVision Dashboard — Blue/Cyan enterprise theme
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Settings, RefreshCw, Maximize, Activity, Wifi, WifiOff, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { useQuery } from '@tanstack/react-query';
import { getDevices } from '@/api/devices';
import type { Device } from '@/types';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22,1,0.36,1] } } };

function CameraCard({ cam }: { cam: Device }) {
  const isOnline = cam.status === 'ONLINE';

  return (
    <div className="glass-card overflow-hidden flex flex-col group hover:border-blue-500/30 transition-all duration-300">
      {/* Top accent */}
      <div className={`h-0.5 w-full transition-opacity ${isOnline ? 'gradient-bg-blue opacity-60 group-hover:opacity-100' : 'bg-slate-600'}`} />

      {/* Video area */}
      <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 relative flex items-center justify-center">
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(hsl(210 40% 98%) 1px, transparent 1px), linear-gradient(90deg, hsl(210 40% 98%) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="flex flex-col items-center gap-2 relative z-10">
          <Camera className="h-10 w-10 text-white/10" />
          <span className="text-white/20 text-[10px] font-mono uppercase tracking-widest">No stream</span>
        </div>

        {/* Status badge top-left */}
        <div className="absolute top-3 left-3 z-20">
          <StatusBadge status={cam.status} size="sm" />
        </div>

        {/* Live indicator top-right */}
        {isOnline && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full border border-cyan-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] text-cyan-400 font-semibold">LIVE</span>
          </div>
        )}

        {/* Fullscreen button */}
        <button className="absolute bottom-3 right-3 h-7 w-7 flex items-center justify-center rounded-lg bg-black/40 text-white/50 hover:text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100">
          <Maximize className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Info section */}
      <div className="p-4 space-y-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">{cam.name}</h3>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{cam.id.slice(0, 8)}…</p>
          </div>
          {isOnline
            ? <Wifi className="h-4 w-4 text-cyan-400 shrink-0" />
            : <WifiOff className="h-4 w-4 text-slate-500 shrink-0" />
          }
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { label: 'Adresse IP', value: cam.ipAddress || 'DHCP' },
            { label: 'Série', value: cam.serialNumber || 'N/A' },
            { label: 'Firmware', value: cam.firmwareVersion || 'v1.0' },
            { label: 'Dernier ping',
              value: cam.lastSeen ? new Date(cam.lastSeen).toLocaleTimeString('fr-FR') : '—',
              icon: Clock },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted/30 rounded-lg p-2 border border-border/20">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
              <p className="font-medium text-foreground truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pt-1">
          <Button variant="outline" size="sm" className="flex-1 text-[11px] h-7 gap-1 hover:border-blue-500/40 hover:text-blue-400">
            <RefreshCw className="h-3 w-3" /> Redémarrer
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-[11px] h-7 gap-1 hover:border-emerald-500/40 hover:text-emerald-400">
            <Activity className="h-3 w-3" /> Calibrer
          </Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 hover:border-blue-500/40 hover:text-blue-400">
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CamerasPage() {
  const { data: devices = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => getDevices(),
    refetchInterval: 30_000,
  });

  const cameras = devices.filter((d: Device) => d.type === 'CAMERA');
  const onlineCount = cameras.filter((c: Device) => c.status === 'ONLINE').length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Caméras & Flux Edge AI"
        description="Supervision des flux en direct et des performances d'inférence"
        icon={Camera}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {onlineCount}/{cameras.length} en ligne
            </div>
            <Button variant="outline" size="sm" className="gap-2 hover:border-blue-500/40 hover:text-blue-400" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Actualiser
            </Button>
          </div>
        }
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      ) : cameras.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="Aucune caméra connectée"
          description="Ajoutez une caméra depuis la gestion de flotte ou attendez sa connexion automatique."
        />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cameras.map((cam: Device) => (
            <motion.div key={cam.id} variants={item}>
              <CameraCard cam={cam} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
