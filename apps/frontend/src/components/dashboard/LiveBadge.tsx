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
  const isConnected = useMqttConnectionStatus();

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="status"
      aria-label={isConnected ? 'MQTT connected — live data' : 'MQTT disconnected'}
    >
      <span
        className={cn(
          'inline-block w-2 h-2 rounded-full',
          isConnected ? 'bg-emerald-400 animate-pulse-dot' : 'bg-slate-500',
        )}
        aria-hidden="true"
      />
      {showLabel && (
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-widest',
            isConnected ? 'text-emerald-400' : 'text-slate-500',
          )}
        >
          {isConnected ? 'Live' : 'Offline'}
        </span>
      )}
    </div>
  );
});
