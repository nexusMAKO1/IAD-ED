/**
 * api/devices.ts — Devices API calls
 * T-032 / F4.2
 */

import apiClient from './client';
import type { Device, CreateDevicePayload, UpdateDevicePayload } from '@/types';

/** GET /api/devices?siteId=xxx — list devices for a site */
export async function getDevices(siteId?: string): Promise<Device[]> {
  const url = siteId ? `/devices?siteId=${siteId}` : '/devices';
  const response = await apiClient.get<Device[]>(url);
  return response.data;
}

/** POST /api/devices — create a new device */
export async function createDevice(payload: CreateDevicePayload): Promise<Device> {
  const { data } = await apiClient.post<Device>('/devices', payload);
  return data;
}

/** PATCH /api/devices/:id — partially update a device */
export async function updateDevice(
  id: string,
  payload: UpdateDevicePayload,
): Promise<Device> {
  const { data } = await apiClient.patch<Device>(`/devices/${id}`, payload);
  return data;
}

/** DELETE /api/devices/:id — remove a device */
export async function deleteDevice(id: string): Promise<void> {
  await apiClient.delete(`/devices/${id}`);
}
