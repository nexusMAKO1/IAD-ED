/**
 * hooks/useSiteSelector.ts — Persistent site selection hook
 * SmartVision IAD Dashboard
 *
 * Persists the selected site ID to localStorage so the selection
 * survives page refreshes. Falls back to the first available site.
 */

import { useState, useEffect } from 'react';
import type { Site } from '@/types';

const STORAGE_KEY = 'sv_selected_site_id';

export function useSiteSelector(sites: Site[]) {
  const [selectedSiteId, setSelectedSiteIdState] = useState<string>(() => {
    // Rehydrate from localStorage on first render
    return localStorage.getItem(STORAGE_KEY) ?? '';
  });

  // Fallback: when sites load and nothing is selected, pick the first
  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      const firstId = sites[0].id;
      setSelectedSiteIdState(firstId);
      localStorage.setItem(STORAGE_KEY, firstId);
    }
  }, [sites, selectedSiteId]);

  const setSelectedSiteId = (id: string) => {
    setSelectedSiteIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const activeSite = sites.find((s) => s.id === selectedSiteId) ?? null;

  return { selectedSiteId, setSelectedSiteId, activeSite };
}
