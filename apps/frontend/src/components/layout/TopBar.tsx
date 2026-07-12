/**
 * components/layout/TopBar.tsx — Professional dashboard header
 * SmartVision IAD Dashboard
 *
 * Security: No dangerouslySetInnerHTML. User data rendered via React JSX auto-escaping.
 * TODO(security): migrate JWT from localStorage to HttpOnly cookie once backend supports it.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Search,
  LogOut,
  User,
  ChevronDown,
  Building2,
  Moon,
  Sun,
  Settings,
  X,
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
  const now = useDateTime();
  const { logout } = useAuth();
  const [siteOpen, setSiteOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [notifCount] = useState(3);

  const activeSite = sites.find((s) => s.id === selectedSiteId);

  const handleLogout = useCallback(async () => {
    try { await apiLogout(); } catch { /* best-effort */ }
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => {
      setSiteOpen(false);
      setUserOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <header
      className="h-16 flex items-center justify-between gap-4 px-6 border-b border-border glass shrink-0 z-20"
      role="banner"
    >
      {/* ── Left: Site Selector ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        {/* Site dropdown */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            id="site-selector-btn"
            aria-haspopup="listbox"
            aria-expanded={siteOpen}
            aria-label="Select site"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-sm font-medium"
            onClick={() => setSiteOpen((v) => !v)}
          >
            <Building2 className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span className="max-w-[140px] truncate">
              {activeSite?.name ?? 'Sélectionner un site'}
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', siteOpen && 'rotate-180')} aria-hidden="true" />
          </button>

          <AnimatePresence>
            {siteOpen && (
              <motion.ul
                role="listbox"
                aria-label="Available sites"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-1.5 w-56 glass-card border border-border rounded-lg overflow-hidden z-50 shadow-xl"
              >
                {sites.map((site) => (
                  <li
                    key={site.id}
                    role="option"
                    aria-selected={site.id === selectedSiteId}
                    className={cn(
                      'px-4 py-2.5 text-sm cursor-pointer transition-colors',
                      site.id === selectedSiteId
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-secondary',
                    )}
                    onClick={() => { onSiteChange(site.id); setSiteOpen(false); }}
                  >
                    {site.name}
                  </li>
                ))}
                {sites.length === 0 && (
                  <li className="px-4 py-2.5 text-sm text-muted-foreground">Aucun site</li>
                )}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        <LiveBadge />
      </div>

      {/* ── Center: Search ──────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-sm hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            id="topbar-search"
            aria-label="Rechercher dans le tableau de bord"
            placeholder="Rechercher sites, caméras, appareils…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-4 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
          {searchValue && (
            <button
              aria-label="Effacer la recherche"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSearchValue('')}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── Right: Actions ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Date/Time */}
        <div className="hidden lg:flex flex-col items-end mr-2" aria-live="polite" aria-atomic="true">
          <span className="text-xs font-semibold text-foreground tabular-nums">{timeStr}</span>
          <span className="text-[10px] text-muted-foreground">{dateStr}</span>
        </div>

        {/* Notifications */}
        <button
          id="notifications-btn"
          aria-label={`Notifications — ${notifCount} non lues`}
          className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-secondary transition-colors"
        >
          <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {notifCount > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center"
              aria-hidden="true"
            >
              {notifCount}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            id="user-menu-btn"
            aria-haspopup="menu"
            aria-expanded={userOpen}
            aria-label="User menu"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setUserOpen((v) => !v)}
          >
            <div className="w-7 h-7 rounded-full bg-primary/20 ring-1 ring-primary/30 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform hidden sm:block', userOpen && 'rotate-180')} aria-hidden="true" />
          </button>

          <AnimatePresence>
            {userOpen && (
              <motion.div
                role="menu"
                aria-label="User options"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1.5 w-48 glass-card border border-border rounded-lg overflow-hidden z-50 shadow-xl"
              >
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary transition-colors text-left"
                  onClick={() => { navigate('/dashboard/profile'); setUserOpen(false); }}
                >
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Profil
                </button>
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary transition-colors text-left"
                  onClick={() => { navigate('/dashboard/settings'); setUserOpen(false); }}
                >
                  <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Paramètres
                </button>
                <div className="border-t border-border my-1" role="separator" />
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-500/10 text-red-400 transition-colors text-left"
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
