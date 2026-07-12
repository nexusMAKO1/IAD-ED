/**
 * components/dashboard/LiveBadge.tsx — MQTT live connection badge
 * IAD SmartVision Dashboard — Blue/Cyan theme
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useMqttConnectionStatus } from '@/mqtt/useMqtt';
import { cn } from '@/lib/utils';

export function LiveBadge() {
  const status = useMqttConnectionStatus();

  const config = {
    connected: {
      label: 'Live',
      icon: Wifi,
      dot: 'bg-cyan-400',
      badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
      pulse: true,
    },
    connecting: {
      label: 'Connexion…',
      icon: Loader2,
      dot: 'bg-amber-400',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
      pulse: false,
    },
    disconnected: {
      label: 'Hors ligne',
      icon: WifiOff,
      dot: 'bg-slate-500',
      badge: 'bg-slate-500/10 text-slate-400 border-slate-500/25',
      pulse: false,
    },
    error: {
      label: 'Erreur MQTT',
      icon: WifiOff,
      dot: 'bg-red-400',
      badge: 'bg-red-500/10 text-red-400 border-red-500/25',
      pulse: false,
    },
  };

  const cfg = config[status as keyof typeof config] ?? config.disconnected;
  const StatusIcon = cfg.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold tracking-wide',
          cfg.badge,
        )}
        role="status"
        aria-label={`MQTT status: ${cfg.label}`}
      >
        {/* Animated dot */}
        <span className="relative flex h-1.5 w-1.5">
          {cfg.pulse && (
            <span
              className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', cfg.dot)}
              aria-hidden="true"
            />
          )}
          <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', cfg.dot)} aria-hidden="true" />
        </span>
        <StatusIcon
          className={cn('h-3 w-3', status === 'connecting' && 'animate-spin')}
          aria-hidden="true"
        />
        {cfg.label}
      </motion.div>
    </AnimatePresence>
  );
}
