/**
 * components/layout/SidebarNav.tsx — Collapsible navigation sidebar
 * SmartVision IAD Dashboard
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Building2,
  Camera,
  Cpu,
  FileText,
  AlertTriangle,
  Activity,
  Settings,
  User,
  MonitorPlay,
  Wifi,
  ChevronLeft,
  ChevronRight,
  Map,
  Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMqttConnectionStatus } from '@/mqtt/useMqtt';

const NAV_ITEMS = [
  { to: '/dashboard',           end: true,  icon: LayoutDashboard, label: 'Tableau de bord',  group: 'Vue d\'ensemble' },
  { to: '/dashboard/analytics', end: false, icon: BarChart3,       label: 'Analytique en Direct', group: 'Vue d\'ensemble' },
  { to: '/dashboard/audience',  end: false, icon: Users,           label: 'Audience',         group: 'Analytique' },
  { to: '/dashboard/heatmap',   end: false, icon: Map,             label: 'Carte de chaleur', group: 'Analytique' },
  { to: '/dashboard/sites',     end: false, icon: Building2,       label: 'Sites',            group: 'Parc Matériel' },
  { to: '/dashboard/cameras',   end: false, icon: Camera,          label: 'Caméras',          group: 'Parc Matériel' },
  { to: '/dashboard/fleet',     end: false, icon: MonitorPlay,     label: 'Appareils',        group: 'Parc Matériel' },
  { to: '/dashboard/campaigns', end: false, icon: Megaphone,       label: 'Campagnes',        group: 'Opérations' },
  { to: '/dashboard/reports',   end: false, icon: FileText,        label: 'Rapports',         group: 'Opérations' },
  { to: '/dashboard/alerts',    end: false, icon: AlertTriangle,   label: 'Alertes',          group: 'Opérations' },
  { to: '/dashboard/monitoring',end: false, icon: Activity,        label: 'Supervision',      group: 'Système' },
  { to: '/dashboard/settings',  end: false, icon: Settings,        label: 'Paramètres',       group: 'Système' },
  { to: '/dashboard/profile',   end: false, icon: User,            label: 'Profil',           group: 'Système' },
] as const;

const GROUPS = ['Vue d\'ensemble', 'Analytique', 'Parc Matériel', 'Opérations', 'Système'] as const;

interface SidebarNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarNav({ collapsed, onToggle }: SidebarNavProps) {
  const isConnected = useMqttConnectionStatus();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="flex flex-col border-r border-border glass shrink-0 overflow-hidden"
      aria-label="Main navigation"
    >
      {/* ── Logo ────────────────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center border-b border-border shrink-0 px-4 gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/40">
          <Wifi className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <p className="text-sm font-semibold leading-none gradient-text whitespace-nowrap">
                Express Display
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                SmartVision v1.0
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5" aria-label="Sidebar navigation">
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((n) => n.group === group);
          return (
            <div key={group} className="mb-2">
              {!collapsed && (
                <p className="mb-1 mt-2 px-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                  {group}
                </p>
              )}
              {items.map(({ to, end, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  aria-label={collapsed ? label : undefined}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-all duration-150 relative',
                      isActive
                        ? 'bg-primary/15 text-primary ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : '')}
                        aria-hidden="true"
                      />
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.1 }}
                            className="flex-1 whitespace-nowrap sidebar-label"
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {!collapsed && (
                        <ChevronRight
                          className="h-3 w-3 opacity-0 -translate-x-1 transition-all group-hover:opacity-50 group-hover:translate-x-0"
                          aria-hidden="true"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="border-t border-border px-3 py-3 flex items-center justify-between shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span
              className={cn('w-2 h-2 rounded-full shrink-0', isConnected ? 'bg-emerald-400' : 'bg-slate-500')}
              aria-hidden="true"
            />
            <span className="text-[10px] text-muted-foreground truncate">
              {isConnected ? 'MQTT connecté' : 'MQTT hors ligne'}
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale'}
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded-md hover:bg-secondary transition-colors',
            collapsed && 'mx-auto',
          )}
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            : <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          }
        </button>
      </div>
    </motion.aside>
  );
}
