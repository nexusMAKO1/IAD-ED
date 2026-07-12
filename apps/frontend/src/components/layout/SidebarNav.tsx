/**
 * components/layout/SidebarNav.tsx — Premium collapsible navigation sidebar
 * IAD SmartVision Dashboard — Blue/Cyan enterprise theme
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BarChart3, Users, Building2, Camera, Cpu, FileText,
  AlertTriangle, Activity, Settings, User, MonitorPlay, Wifi, ChevronLeft,
  ChevronRight, Map, Megaphone, Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMqttConnectionStatus } from '@/mqtt/useMqtt';

const NAV_ITEMS = [
  { to: '/dashboard',            end: true,  icon: LayoutDashboard, label: 'Tableau de bord',    group: 'Vue d\'ensemble' },
  { to: '/dashboard/analytics',  end: false, icon: BarChart3,       label: 'Analytique Live',    group: 'Vue d\'ensemble' },
  { to: '/dashboard/audience',   end: false, icon: Users,           label: 'Audience',           group: 'Analytique' },
  { to: '/dashboard/heatmap',    end: false, icon: Map,             label: 'Carte de chaleur',   group: 'Analytique' },
  { to: '/dashboard/sites',      end: false, icon: Building2,       label: 'Sites',              group: 'Infrastructure' },
  { to: '/dashboard/cameras',    end: false, icon: Camera,          label: 'Caméras',            group: 'Infrastructure' },
  { to: '/dashboard/fleet',      end: false, icon: MonitorPlay,     label: 'Appareils',          group: 'Infrastructure' },
  { to: '/dashboard/campaigns',  end: false, icon: Megaphone,       label: 'Campagnes',          group: 'Opérations' },
  { to: '/dashboard/reports',    end: false, icon: FileText,        label: 'Rapports',           group: 'Opérations' },
  { to: '/dashboard/alerts',     end: false, icon: AlertTriangle,   label: 'Alertes',            group: 'Opérations' },
  { to: '/dashboard/monitoring', end: false, icon: Activity,        label: 'Supervision',        group: 'Système' },
  { to: '/dashboard/settings',   end: false, icon: Settings,        label: 'Paramètres',         group: 'Système' },
  { to: '/dashboard/profile',    end: false, icon: User,            label: 'Profil',             group: 'Système' },
] as const;

const GROUPS = ['Vue d\'ensemble', 'Analytique', 'Infrastructure', 'Opérations', 'Système'] as const;

interface SidebarNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarNav({ collapsed, onToggle }: SidebarNavProps) {
  const mqttStatus = useMqttConnectionStatus();
  const isConnected = mqttStatus === 'connected';

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 248 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col shrink-0 overflow-hidden relative"
      style={{
        background: 'hsl(215 28% 8% / 0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid hsl(215 20% 20% / 0.5)',
      }}
      aria-label="Main navigation"
    >
      {/* ── Logo ─────────────────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center shrink-0 px-4 gap-3 border-b border-border/30">
        {/* IAD Logo icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl gradient-bg-blue ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/20">
          <Radio className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <p className="text-sm font-bold leading-none gradient-text-blue whitespace-nowrap">
                SmartVision IAD
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap font-medium">
                Express Display v1.0
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5"
        style={{ padding: '12px 8px' }}
        aria-label="Sidebar navigation"
      >
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((n) => n.group === group);
          return (
            <div key={group} className="mb-1">
              {/* Group label */}
              <AnimatePresence>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mb-1 mt-3 px-3 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40"
                  >
                    {group}
                  </motion.p>
                )}
              </AnimatePresence>

              {items.map(({ to, end, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  aria-label={collapsed ? label : undefined}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-blue-500/12 text-blue-400 nav-active-bar'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300',
                        )}
                        aria-hidden="true"
                      />
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            className="flex-1 whitespace-nowrap sidebar-label"
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className="border-t border-border/30 px-3 py-3 flex items-center justify-between shrink-0">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 min-w-0"
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  isConnected ? 'bg-cyan-400' : 'bg-slate-600',
                )}
                aria-hidden="true"
              />
              <span className="text-[10px] text-muted-foreground truncate font-medium">
                {isConnected ? 'MQTT connecté' : mqttStatus === 'connecting' ? 'Connexion…' : 'MQTT hors ligne'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale'}
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded-lg hover:bg-white/8 transition-colors text-muted-foreground hover:text-foreground',
            collapsed && 'mx-auto',
          )}
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            : <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>
    </motion.aside>
  );
}
