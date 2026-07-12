import apiClient from './client';

export async function getDisplayDevices(filters?: { status?: string; siteId?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.siteId) params.append('siteId', filters.siteId);
  const response = await apiClient.get(`/display-devices?${params.toString()}`);
  return response.data;
}

export async function pairDisplayDevice(id: string, siteId: string, screenId?: string) {
  const response = await apiClient.patch(`/display-devices/${id}/pair`, { siteId, screenId });
  return response.data;
}

export async function unpairDisplayDevice(id: string) {
  const response = await apiClient.patch(`/display-devices/${id}/unpair`);
  return response.data;
}

export async function removeDisplayDevice(id: string) {
  const response = await apiClient.delete(`/display-devices/${id}`);
  return response.data;
}
