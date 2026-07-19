import apiClient from './client';

export interface EdgeDevice {
  id: string;
  deviceId: string;
  siteId: string | null;
  zoneId: string | null;
  hostname: string | null;
  friendlyName: string | null;
  ip: string | null;
  macAddress: string | null;
  platform: string | null;
  resolution: string | null;
  fps: number | null;
  status: 'UNPAIRED' | 'ONLINE' | 'WARNING' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';
  version: string | null;
  model: string | null;
  firmwareVersion: string | null;
  uptime: number;
  cpuUsage: number | null;
  memoryUsage: number | null;
  streamUrl: string | null;
  mqttConnected: boolean;
  lastSeen: string | null;
  lastHeartbeat: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  site?: any;
}

export const getEdgeDevices = async () => {
  const { data } = await apiClient.get<EdgeDevice[]>('/edge-devices');
  return data;
};

export const getUnpairedEdgeDevices = async () => {
  const { data } = await apiClient.get<EdgeDevice[]>('/edge-devices/unpaired');
  return data;
};

export const pairEdgeDevice = async (id: string, payload: { siteId: string; zoneId: string }) => {
  const { data } = await apiClient.patch<EdgeDevice>(`/edge-devices/${id}/pair`, payload);
  return data;
};

export const unpairEdgeDevice = async (id: string) => {
  const { data } = await apiClient.patch<EdgeDevice>(`/edge-devices/${id}/unpair`);
  return data;
};

export const deleteEdgeDevice = async (id: string) => {
  const { data } = await apiClient.delete(`/edge-devices/${id}`);
  return data;
};

export const assignSiteEdgeDevice = async (id: string, payload: { siteId: string; zoneId?: string }) => {
  const { data } = await apiClient.post<EdgeDevice>(`/edge-devices/${id}/assign-site`, payload);
  return data;
};

export const updateEdgeDeviceSettings = async (id: string, settings: any) => {
  const { data } = await apiClient.post(`/edge-devices/${id}/settings`, settings);
  return data;
};

export const restartEdgeDevice = async (id: string) => {
  const { data } = await apiClient.post(`/edge-devices/${id}/restart`);
  return data;
};

export const updateEdgeDevice = async (id: string, payload: Partial<EdgeDevice>) => {
  const { data } = await apiClient.patch<EdgeDevice>(`/edge-devices/${id}`, payload);
  return data;
};
