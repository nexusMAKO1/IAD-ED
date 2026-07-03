import { NavLink, Outlet } from 'react-router-dom';
import {
  MonitorPlay,
  LayoutDashboard,
  ChevronRight,
  Wifi,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    to: '/dashboard',
    end: true,
    icon: LayoutDashboard,
    label: "Vue d'ensemble",
  },
  {
    to: '/dashboard/fleet',
    end: false,
    icon: MonitorPlay,
    label: "Parc d'écrans",
  },
];

export function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="flex w-64 flex-col border-r border-border glass shrink-0">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/40">
            <Wifi className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none gradient-text">
              Express Display
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              SmartVision Dashboard
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Navigation
          </p>
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-50 group-hover:translate-x-0" />
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          <p className="text-[10px] text-muted-foreground">
            IAD & SmartQueue AI v1.0
          </p>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
