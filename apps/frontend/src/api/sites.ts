/**
 * api/sites.ts — Sites API calls
 * T-032 / F4.2 & F4.3
 */

import apiClient from './client';
import type { Site, UpdateSiteThresholdsPayload } from '@/types';

/** GET /api/sites — list all sites (for the site selector dropdown) */
export async function getSites(): Promise<Site[]> {
  const { data } = await apiClient.get<Site[]>('/sites');
  return data;
}

/** GET /api/sites/:id — get a single site by ID */
export async function getSite(id: string): Promise<Site> {
  const { data } = await apiClient.get<Site>(`/sites/${id}`);
  return data;
}

/** PATCH /api/sites/:id/thresholds — update density & anomaly thresholds */
export async function updateSiteThresholds(
  id: string,
  payload: UpdateSiteThresholdsPayload,
): Promise<Site> {
  const { data } = await apiClient.patch<Site>(`/sites/${id}/thresholds`, payload);
  return data;
}
