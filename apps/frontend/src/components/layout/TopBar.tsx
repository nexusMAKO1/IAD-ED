/**
 * components/layout/TopBar.tsx — Premium dashboard header
 * IAD SmartVision Dashboard — Blue/Cyan enterprise theme
 *
 * Security: No dangerouslySetInnerHTML. User data via React JSX auto-escaping.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Search, LogOut, User, ChevronDown, Building2,
  Settings, X, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveBadge } from '@/components/dashboard/LiveBadge';
import { useAuth } from '@/store/AuthContext';
import { logout as apiLogout } from '@/api/auth';
import type { Site } from '@/types';

interface TopBarProps {
  sites: Site[];
  selectedSiteId: string;
  onSiteChange: (id: string) => void;
  onMenuToggle?: () => void;
}

// Breadcrumb map for routes
const ROUTE_LABELS: Record<string, string> = {
  '':           'Tableau de bord',
  analytics:    'Analytique Live',
  audience:     'Audience',
  heatmap:      'Carte de chaleur',
  sites:        'Sites',
  cameras:      'Caméras',
  fleet:        'Appareils',
  campaigns:    'Campagnes',
  reports:      'Rapports',
  alerts:       'Alertes',
  monitoring:   'Supervision',
  settings:     'Paramètres',
  profile:      'Profil',
};

function useDateTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function TopBar({ sites, selectedSiteId, onSiteChange }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const now = useDateTime();
  const { user, logout } = useAuth();
  const [siteOpen, setSiteOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [notifCount] = useState(3);

  const activeSite = sites.find((s) => s.id === selectedSiteId);

  // Build breadcrumb from path
  const pathSegments = location.pathname.replace('/dashboard', '').split('/').filter(Boolean);
  const currentPage = ROUTE_LABELS[pathSegments[0] ?? ''] ?? 'Tableau de bord';

  const handleLogout = useCallback(async () => {
    try { await apiLogout(); } catch { /* best-effort */ }
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => { setSiteOpen(false); setUserOpen(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <header
      className="h-14 flex items-center justify-between gap-4 px-5 shrink-0 z-20"
      style={{
        background: 'hsl(215 28% 8% / 0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid hsl(215 20% 20% / 0.5)',
      }}
      role="banner"
    >
      {/* ── Left: Breadcrumb + Site Selector ────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Breadcrumb */}
        <nav className="hidden md:flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <span>Tableau de bord</span>
          {pathSegments.length > 0 && (
            <>
              <ChevronRight className="h-3 w-3 opacity-40" />
              <span className="text-foreground font-medium">{currentPage}</span>
            </>
          )}
        </nav>

        <div className="hidden md:block w-px h-4 bg-border/50" />

        {/* Site Selector */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            id="site-selector-btn"
            aria-haspopup="listbox"
            aria-expanded={siteOpen}
            aria-label="Sélectionner un site"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150"
            style={{
              background: siteOpen ? 'hsl(221 83% 53% / 0.15)' : 'hsl(215 25% 16% / 0.8)',
              border: `1px solid ${siteOpen ? 'hsl(221 83% 53% / 0.4)' : 'hsl(215 20% 25% / 0.6)'}`,
            }}
            onClick={() => setSiteOpen((v) => !v)}
          >
            <Building2 className="h-3.5 w-3.5 text-blue-400 shrink-0" aria-hidden="true" />
            <span className="max-w-[120px] truncate">
              {selectedSiteId === 'ALL' ? 'Tous les sites' : (activeSite?.name ?? 'Sélectionner un site')}
            </span>
            <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', siteOpen && 'rotate-180')} aria-hidden="true" />
          </button>

          <AnimatePresence>
            {siteOpen && (
              <motion.ul
                role="listbox"
                aria-label="Sites disponibles"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-1.5 w-56 rounded-xl overflow-hidden z-50 shadow-2xl"
                style={{
                  background: 'hsl(215 25% 12%)',
                  border: '1px solid hsl(215 20% 22%)',
                }}
              >
                <li
                  role="option"
                  aria-selected={'ALL' === selectedSiteId}
                  className={cn(
                    'px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2',
                    'ALL' === selectedSiteId
                      ? 'bg-blue-500/12 text-blue-400'
                      : 'text-foreground hover:bg-white/5',
                  )}
                  onClick={() => { onSiteChange('ALL'); setSiteOpen(false); }}
                >
                  {'ALL' === selectedSiteId && (
                    <span className="w-1 h-1 rounded-full bg-blue-400" aria-hidden="true" />
                  )}
                  Tous les sites
                </li>
                {sites.map((site) => (
                  <li
                    key={site.id}
                    role="option"
                    aria-selected={site.id === selectedSiteId}
                    className={cn(
                      'px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2',
                      site.id === selectedSiteId
                        ? 'bg-blue-500/12 text-blue-400'
                        : 'text-foreground hover:bg-white/5',
                    )}
                    onClick={() => { onSiteChange(site.id); setSiteOpen(false); }}
                  >
                    {site.id === selectedSiteId && (
                      <span className="w-1 h-1 rounded-full bg-blue-400" aria-hidden="true" />
                    )}
                    {site.name}
                  </li>
                ))}
                {sites.length === 0 && (
                  <li className="px-4 py-3 text-sm text-muted-foreground">Aucun site disponible</li>
                )}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        <LiveBadge />
      </div>

      {/* ── Center: Search ───────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-xs hidden lg:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            id="topbar-search"
            aria-label="Rechercher dans le tableau de bord"
            placeholder="Rechercher sites, caméras…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full rounded-lg pl-9 pr-4 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none transition-all"
            style={{
              background: 'hsl(215 25% 14% / 0.8)',
              border: '1px solid hsl(215 20% 25% / 0.5)',
            }}
          />
          {searchValue && (
            <button
              aria-label="Effacer la recherche"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSearchValue('')}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── Right: Clock + Notifications + User Menu ─────────────────────────── */}
      <div className="flex items-center gap-1">
        {/* Clock */}
        <div className="hidden xl:flex flex-col items-end mr-2 tabular-nums" aria-live="polite" aria-atomic="true">
          <span className="text-xs font-semibold text-foreground">{timeStr}</span>
          <span className="text-[10px] text-muted-foreground capitalize">{dateStr}</span>
        </div>

        {/* Notifications */}
        <button
          id="notifications-btn"
          aria-label={`Notifications — ${notifCount} non lues`}
          className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/6 transition-colors"
        >
          <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {notifCount > 0 && (
            <span
              className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center"
              aria-hidden="true"
            >
              {notifCount}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-border/40 mx-1" />

        {/* User menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            id="user-menu-btn"
            aria-haspopup="menu"
            aria-expanded={userOpen}
            aria-label="Menu utilisateur"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/6 transition-colors"
            onClick={() => setUserOpen((v) => !v)}
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full flex items-center justify-center gradient-bg-blue ring-1 ring-blue-500/40 text-white text-xs font-bold shrink-0">
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <span className="hidden sm:block text-xs font-medium text-foreground max-w-[80px] truncate">
              {user?.email?.split('@')[0] ?? 'Utilisateur'}
            </span>
            <ChevronDown
              className={cn('h-3 w-3 text-muted-foreground transition-transform hidden sm:block', userOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          <AnimatePresence>
            {userOpen && (
              <motion.div
                role="menu"
                aria-label="Options utilisateur"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1.5 w-48 rounded-xl overflow-hidden z-50 shadow-2xl"
                style={{
                  background: 'hsl(215 25% 12%)',
                  border: '1px solid hsl(215 20% 22%)',
                }}
              >
                {/* User info header */}
                <div className="px-4 py-3 border-b border-border/30">
                  <p className="text-xs font-semibold text-foreground truncate">{user?.email ?? 'Utilisateur'}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{user?.role?.toLowerCase() ?? 'admin'}</p>
                </div>

                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left"
                  onClick={() => { navigate('/dashboard/profile'); setUserOpen(false); }}
                >
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Profil
                </button>
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left"
                  onClick={() => { navigate('/dashboard/settings'); setUserOpen(false); }}
                >
                  <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Paramètres
                </button>
                <div className="border-t border-border/30 my-1" role="separator" />
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-500/8 text-red-400 transition-colors text-left"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Déconnexion
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
