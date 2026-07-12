/**
 * api/audience.ts — Audience & Analytics API calls
 * SmartVision IAD Dashboard
 */

import apiClient from './client';
import type { AudienceStats, DemographicsData, TimeSeriesPoint } from '@/types';

/** GET /api/v1/sites/:id/statistics — aggregated audience stats */
export async function getAudienceStats(siteId: string): Promise<AudienceStats> {
  const { data } = await apiClient.get<AudienceStats>(`/sites/${siteId}/statistics`);
  return data;
}

/** GET /api/v1/sites/:id/audience-events — raw audience events */
export async function getAudienceEvents(siteId: string) {
  const { data } = await apiClient.get(`/sites/${siteId}/audience-events`);
  return data;
}

/** GET /api/v1/sites/:id/demographics — demographics breakdown */
export async function getDemographics(siteId: string): Promise<DemographicsData> {
  const { data } = await apiClient.get<DemographicsData>(`/sites/${siteId}/demographics`);
  return data;
}

/** GET /api/v1/sites/:id/timeseries — visitor time series */
export async function getVisitorTimeseries(
  siteId: string,
  granularity: 'minute' | 'hour' | 'day' = 'hour',
): Promise<TimeSeriesPoint[]> {
  const { data } = await apiClient.get<TimeSeriesPoint[]>(
    `/sites/${siteId}/timeseries`,
    { params: { granularity } },
  );
  return data;
}
