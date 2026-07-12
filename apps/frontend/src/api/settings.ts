/**
 * api/settings.ts — Settings API calls
 */

import apiClient from './client';
import type { AppSettings } from '@/types';

/** GET /api/settings — get application settings */
export async function getSettings(): Promise<AppSettings> {
  const { data } = await apiClient.get<AppSettings>('/settings');
  return data;
}

/** PATCH /api/settings — update application settings */
export async function updateSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  const { data } = await apiClient.patch<AppSettings>('/settings', payload);
  return data;
}
