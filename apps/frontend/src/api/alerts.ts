/**
 * api/alerts.ts — Alerts API calls
 * SmartVision IAD Dashboard
 */

import apiClient from './client';
import type { AlertItem } from '@/types';

/** GET /api/v1/alerts — list all alerts, optionally filtered */
export async function getAlerts(params?: {
  siteId?: string;
  severity?: string;
  acknowledged?: boolean;
  limit?: number;
}): Promise<AlertItem[]> {
  const { data } = await apiClient.get<AlertItem[]>('/alerts', { params });
  return data;
}

/** PATCH /api/v1/alerts/:id/acknowledge — mark an alert as acknowledged */
export async function acknowledgeAlert(id: string): Promise<AlertItem> {
  const { data } = await apiClient.patch<AlertItem>(`/alerts/${id}/acknowledge`);
  return data;
}

/** DELETE /api/v1/alerts/:id — delete an alert */
export async function deleteAlert(id: string): Promise<void> {
  await apiClient.delete(`/alerts/${id}`);
}
