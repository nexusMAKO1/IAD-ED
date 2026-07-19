/**
 * api/audience.ts — Audience & Analytics API calls
 * SmartVision IAD Dashboard
 */

import apiClient from './client';
import type { AudienceStats, DemographicsData, TimeSeriesPoint, AudienceEvent } from '@/types';

/** GET /api/v1/sites/:id/statistics — aggregated audience stats */
export async function getAudienceStats(siteId: string): Promise<AudienceStats> {
  const { data } = await apiClient.get<AudienceStats>(`/sites/${siteId}/statistics`);
  return data;
}

export async function getAudienceEvents(siteId: string): Promise<AudienceEvent[]> {
  const { data } = await apiClient.get<AudienceEvent[]>(`/sites/${siteId}/audience-events`);
  return Array.isArray(data) ? data : [];
}

/** GET /api/v1/sites/:id/demographics — demographics breakdown */
export async function getDemographics(siteId: string): Promise<DemographicsData> {
  const { data } = await apiClient.get<DemographicsData>(`/sites/${siteId}/demographics`);
  return data;
}

/** GET /api/v1/sites/:id/timeseries — visitor time series
 *
 * Backend returns: { timestamp: string; visitors: number }[]
 * Frontend chart expects: { time: string; value: number }[] (TimeSeriesPoint)
 *
 * We normalise at the API boundary so chart components never receive
 * undefined keys, which would cause "TypeError: undefined is not an object
 * (evaluating 't.length')" inside Recharts internals.
 */
export async function getVisitorTimeseries(
  siteId: string,
  granularity: 'minute' | 'hour' | 'day' = 'hour',
): Promise<TimeSeriesPoint[]> {
  const { data } = await apiClient.get<{ timestamp: string; visitors: number }[]>(
    `/sites/${siteId}/timeseries`,
    { params: { granularity } },
  );

  if (!Array.isArray(data)) return [];

  return data.map((row) => ({
    time: new Date(row.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    value: Number(row.visitors ?? 0),
  }));
}
