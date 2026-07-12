/**
 * components/dashboard/StatusBadge.tsx — Device / site status badge
 * IAD SmartVision Dashboard
 */
import React from 'react';
import { cn } from '@/lib/utils';

type Status = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'WARNING' | 'ERROR' | 'UNKNOWN' | string;

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  ONLINE:    { label: 'En ligne',   className: 'status-online' },
  OFFLINE:   { label: 'Hors ligne', className: 'status-offline' },
  DEGRADED:  { label: 'Dégradé',   className: 'status-degraded' },
  WARNING:   { label: 'Attention',  className: 'status-warning' },
  ERROR:     { label: 'Erreur',     className: 'status-error' },
  UNKNOWN:   { label: 'Inconnu',    className: 'status-offline' },
};

export function StatusBadge({ status, size = 'md', showDot = true }: StatusBadgeProps) {
  const cfg = statusConfig[status?.toUpperCase()] ?? statusConfig.UNKNOWN;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold border rounded-full',
        cfg.className,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
      )}
      role="status"
      aria-label={cfg.label}
    >
      {showDot && (
        <span
          className={cn('rounded-full shrink-0', size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2', 'bg-current')}
          aria-hidden="true"
        />
      )}
      {cfg.label}
    </span>
  );
}
