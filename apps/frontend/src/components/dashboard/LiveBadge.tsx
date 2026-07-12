/**
 * components/dashboard/LiveBadge.tsx — MQTT live status indicator
 * SmartVision IAD Dashboard
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { useMqttConnectionStatus } from '@/mqtt/useMqtt';

interface LiveBadgeProps {
  className?: string;
  showLabel?: boolean;
}

export const LiveBadge = React.memo(function LiveBadge({
  className,
  showLabel = true,
}: LiveBadgeProps) {
  const mqttState = useMqttConnectionStatus();

  let dotColor = 'bg-slate-500';
  let textColor = 'text-slate-500';
  let label = 'Hors ligne';
  let isPulsing = false;

  switch (mqttState) {
    case 'connected':
      dotColor = 'bg-emerald-400';
      textColor = 'text-emerald-400';
      label = 'Connecté';
      isPulsing = true;
      break;
    case 'connecting':
      dotColor = 'bg-amber-400';
      textColor = 'text-amber-400';
      label = 'Connexion...';
      isPulsing = true;
      break;
    case 'error':
      dotColor = 'bg-red-500';
      textColor = 'text-red-500';
      label = 'Erreur Auth';
      break;
    case 'disconnected':
    default:
      dotColor = 'bg-slate-500';
      textColor = 'text-slate-500';
      label = 'Déconnecté';
      break;
  }

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="status"
      aria-label={`MQTT Status: ${label}`}
    >
      <span
        className={cn(
          'inline-block w-2 h-2 rounded-full',
          dotColor,
          isPulsing && 'animate-pulse-dot',
        )}
        aria-hidden="true"
      />
      {showLabel && (
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-widest',
            textColor,
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
});
