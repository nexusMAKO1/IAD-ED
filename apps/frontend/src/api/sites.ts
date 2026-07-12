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

/** POST /api/sites — create a new site */
export const createSite = async (payload: { name: string; address: string }): Promise<Site> => {
  const { data } = await apiClient.post<Site>('/sites', payload);
  return data;
}

/** GET /api/sites/:id — get a single site by ID */
export async function getSite(id: string): Promise<Site> {
  const { data } = await apiClient.get<Site>(`/sites/${id}`);
  return data;
}

/** PATCH /api/sites/:id — update a site */
export const updateSite = async (
  siteId: string,
  payload: { name?: string; address?: string }
) => {
  const { data } = await apiClient.patch<Site>(`/sites/${siteId}`, payload);
  return data;
};

/** DELETE /api/sites/:id — delete a site */
export const deleteSite = async (siteId: string): Promise<void> => {
  await apiClient.delete(`/sites/${siteId}`);
};

/** PATCH /api/sites/:id/thresholds — update density & anomaly thresholds */
export const updateSiteThresholds = async (
  siteId: string,
  payload: { densityThreshold?: number; anomalyQueueThreshold?: number }
) => {
  const { data } = await apiClient.patch<Site>(`/sites/${siteId}/thresholds`, payload);
  return data;
};

/** GET /api/sites/:id/statistics — get aggregated audience statistics */
export const getAudienceStatistics = async (siteId: string) => {
  const { data } = await apiClient.get(`/sites/${siteId}/statistics`);
  return data;
};

/** GET /api/sites/:id/audience-events — get recent audience events */
export const getAudienceEvents = async (siteId: string) => {
  const { data } = await apiClient.get(`/sites/${siteId}/audience-events`);
  return data;
};
