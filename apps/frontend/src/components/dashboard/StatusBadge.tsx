/**
 * components/dashboard/StatusBadge.tsx — Reusable colored status badge
 * SmartVision IAD Dashboard
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { DeviceStatus, CameraStatus, ServiceStatus } from '@/types';

type AnyStatus = DeviceStatus | CameraStatus | ServiceStatus | string;

interface StatusBadgeProps {
  status: AnyStatus;
  className?: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<string, string> = {
  // Device statuses
  ONLINE:      'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  OFFLINE:     'text-slate-400   bg-slate-400/10   border-slate-400/25',
  DEGRADED:    'text-amber-400   bg-amber-400/10   border-amber-400/25',
  // Camera statuses
  online:      'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  offline:     'text-slate-400   bg-slate-400/10   border-slate-400/25',
  degraded:    'text-amber-400   bg-amber-400/10   border-amber-400/25',
  calibrating: 'text-blue-400    bg-blue-400/10    border-blue-400/25',
  // Service statuses
  healthy:     'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  unhealthy:   'text-red-400     bg-red-400/10     border-red-400/25',
};

const dotColors: Record<string, string> = {
  ONLINE: 'bg-emerald-400', online: 'bg-emerald-400', healthy: 'bg-emerald-400',
  OFFLINE: 'bg-slate-500',  offline: 'bg-slate-500',  unhealthy: 'bg-red-400',
  DEGRADED: 'bg-amber-400', degraded: 'bg-amber-400',
  calibrating: 'bg-blue-400',
};

export const StatusBadge = React.memo(function StatusBadge({
  status,
  className,
  size = 'md',
}: StatusBadgeProps) {
  const styleClass = statusStyles[status] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/25';
  const dotClass = dotColors[status] ?? 'bg-slate-500';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border rounded-full font-medium',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        styleClass,
        className,
      )}
      role="status"
      aria-label={`Status: ${status}`}
    >
      <span className={cn('rounded-full', size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2', dotClass)} aria-hidden="true" />
      {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
    </span>
  );
});
