/**
 * layouts/DashboardLayout.tsx — Main dashboard shell
 * SmartVision IAD Dashboard
 *
 * Composes SidebarNav + TopBar + animated page outlet.
 * Sidebar collapse state is persisted in localStorage.
 */

import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { TopBar } from '@/components/layout/TopBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getSites } from '@/api/sites';
import { useSiteSelector } from '@/hooks/useSiteSelector';

const SIDEBAR_KEY = 'sv_sidebar_collapsed';

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  });

  const handleToggle = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

  // Fetch sites for the TopBar site selector
  const { data: sites = [], isLoading: isSitesLoading, error: sitesError, refetch: refetchSites } = useQuery({
    queryKey: ['sites'],
    queryFn: getSites,
    staleTime: 5 * 60 * 1000,
  });

  const { selectedSiteId, setSelectedSiteId } = useSiteSelector(sites);

  // Collapse sidebar automatically on small screens
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    if (mq.matches) setCollapsed(true);
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setCollapsed(true);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <SidebarNav collapsed={collapsed} onToggle={handleToggle} />

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <TopBar
          sites={sites}
          selectedSiteId={selectedSiteId}
          onSiteChange={setSelectedSiteId}
        />

        {/* Page content */}
        <motion.main
          key="main-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto"
          id="main-content"
          aria-label="Page content"
        >
          <ErrorBoundary>
            <Outlet context={{ selectedSiteId, sites, isSitesLoading, sitesError, refetchSites }} />
          </ErrorBoundary>
        </motion.main>
      </div>
    </div>
  );
}
