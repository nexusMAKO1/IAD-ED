/**
 * api/devices.ts — Unified Devices API calls
 * T-032 / F4.2
 */

import apiClient from './client';
import type { Device, CreateDevicePayload, UpdateDevicePayload, DeviceType, DeviceStatus } from '@/types';

/** GET /api/devices?siteId=xxx&type=yyy&status=zzz&unassigned=true — list devices */
export async function getDevices(filters?: {
  siteId?: string;
  type?: DeviceType;
  status?: DeviceStatus;
  unassigned?: boolean;
}): Promise<Device[]> {
  const params = new URLSearchParams();
  if (filters?.siteId) params.append('siteId', filters.siteId);
  if (filters?.type) params.append('type', filters.type);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.unassigned) params.append('unassigned', 'true');
  
  const response = await apiClient.get<Device[]>(`/devices?${params.toString()}`);
  return response.data;
}

export async function getDevice(id: string): Promise<Device> {
  const { data } = await apiClient.get<Device>(`/devices/${id}`);
  return data;
}

export async function createDevice(payload: CreateDevicePayload): Promise<Device> {
  const { data } = await apiClient.post<Device>('/devices', payload);
  return data;
}

export async function updateDevice(
  id: string,
  payload: UpdateDevicePayload,
): Promise<Device> {
  const { data } = await apiClient.patch<Device>(`/devices/${id}`, payload);
  return data;
}

export async function assignSiteDevice(
  id: string, 
  payload: { siteId: string; zoneId?: string; screenId?: string }
): Promise<Device> {
  const { data } = await apiClient.post<Device>(`/devices/${id}/assign-site`, payload);
  return data;
}

export async function unpairDevice(id: string): Promise<Device> {
  const { data } = await apiClient.post<Device>(`/devices/${id}/unpair`);
  return data;
}

export async function updateCameraSettings(id: string, settings: any) {
  const { data } = await apiClient.post(`/devices/${id}/settings`, settings);
  return data;
}

export async function restartDevice(id: string) {
  const { data } = await apiClient.post(`/devices/${id}/restart`);
  return data;
}

export async function deleteDevice(id: string): Promise<void> {
  await apiClient.delete(`/devices/${id}`);
}
