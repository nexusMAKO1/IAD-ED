/**
 * types/index.ts — Shared TypeScript types for IAD & SmartQueue frontend
 * T-032 / F4.2 & F4.3
 */

// ─── Enums (mirrored from Prisma) ─────────────────────────────────────────────

export type DeviceType =
  | 'DISPLAY'
  | 'EDGE_CAMERA'
  | 'TOTEM'
  | 'WAITING_ROOM_SCREEN'
  | 'TICKET_KIOSK';

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'WARNING' | 'UNKNOWN';

export type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT';

// ─── Domain Models ─────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  name: string;
  address: string;
  densityThreshold: number;
  anomalyQueueThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  deviceId: string;
  name: string;
  type: DeviceType;
  siteId: string | null;
  status: DeviceStatus;
  hostname: string | null;
  ip: string | null;
  platform: string | null;
  version: string | null;
  firmwareVersion: string | null;
  mqttClientId: string | null;
  lastHeartbeat: string | null;
  lastSeen: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  mqttConnected: boolean;
  uptime: number;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  site?: any;
  cameraMetadata?: CameraMetadata | null;
  displayMetadata?: DisplayMetadata | null;
}

export interface CameraMetadata {
  id: string;
  deviceId: string;
  fps: number | null;
  resolution: string | null;
  streamUrl: string | null;
  cameraIndex: number | null;
  model: string | null;
  cpuUsage: number | null;
  memoryUsage: number | null;
  zoneId: string | null;
  detectionEnabled: boolean;
  ageEstimatorEnabled: boolean;
  macAddress: string | null;
}

export interface DisplayMetadata {
  id: string;
  deviceId: string;
  screenResolution: string | null;
  playlist: string | null;
  activeCampaign: string | null;
  kioskVersion: string | null;
  screenId: string | null;
}

// ─── DTOs (Request payloads) ────────────────────────────────────────────────────

export interface UpdateSiteThresholdsPayload {
  densityThreshold: number;
  anomalyQueueThreshold: number;
}

export interface CreateDevicePayload {
  name: string;
  type: DeviceType;
  ip?: string;
  siteId: string;
}

export interface UpdateDevicePayload {
  name?: string;
  type?: DeviceType;
  ip?: string;
  status?: DeviceStatus;
  serialNumber?: string;
  firmwareVersion?: string;
  mqttClientId?: string;
  siteId?: string;
}

// ─── API Error shape ───────────────────────────────────────────────────────────

export interface ApiValidationError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/** Extract field-level error messages from NestJS ValidationPipe responses */
export function extractFieldErrors(
  error: ApiValidationError,
): Record<string, string> {
  const messages = Array.isArray(error.message) ? error.message : [error.message];
  const fieldErrors: Record<string, string> = {};
  for (const msg of messages) {
    const match = /^(\w+)\s/.exec(msg);
    if (match) {
      fieldErrors[match[1]] = msg;
    } else {
      fieldErrors['_general'] = msg;
    }
  }
  return fieldErrors;
}

/** Safely extract a human-readable error message from an unknown error shape */
export function getErrorMessage(error: unknown, fallback = 'Une erreur inattendue est survenue'): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;

    // Axios error: e.response.data.message
    const response = e['response'] as Record<string, unknown> | undefined;
    if (response) {
      const data = response['data'] as Record<string, unknown> | undefined;
      if (data) {
        if (typeof data['message'] === 'string') return data['message'];
        if (Array.isArray(data['message']) && typeof data['message'][0] === 'string') return data['message'][0];
        if (typeof data['error'] === 'string') return data['error'];
      }
    }

    // Generic error object
    if (typeof e['error'] === 'string') return e['error'];
    if (typeof e['message'] === 'string') return e['message'];
    if (Array.isArray(e['message']) && typeof e['message'][0] === 'string') return e['message'][0];
  }
  if (typeof error === 'string') return error;
  return fallback;
}

// ─── SmartVision IAD — Audience & Analytics ────────────────────────────────────

export interface AudienceStats {
  currentVisitors: number;
  dailyVisitors: number;
  avgWaitTime: number;
  activeCampaigns: number;
  attentionRate: number;
  avgQueueLength: number;
  crowdDensity: 'low' | 'medium' | 'high' | 'critical';
  malePercent: number;
  femalePercent: number;
  childrenCount: number;
  adultsCount: number;
  seniorsCount: number;
}

export interface TimeSeriesPoint {
  time: string;
  value: number;
}

export interface DemographicsData {
  genderSplit: { name: string; value: number; color: string }[];
  ageGroups: { group: string; count: number }[];
  genderByHour: { hour: string; male: number; female: number }[];
  ageByHour: { hour: string; children: number; adults: number; seniors: number }[];
  returningVisitors: number;
  newVisitors: number;
  peakHour: string;
  peakCount: number;
}

export interface AudienceEvent {
  id: string;
  timestamp: string;
  siteId: string;
  deviceId: string;
  ageGroup: string;
  gender: string;
  confidence: number;
  count: number;
  emotion?: string;
  dwellTime?: number;
}

// ─── SmartVision IAD — Cameras ────────────────────────────────────────────────



// ─── SmartVision IAD — Alerts ─────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType =
  | 'camera_offline'
  | 'high_density'
  | 'low_fps'
  | 'device_disconnected'
  | 'backend_offline'
  | 'mqtt_disconnected';

export interface AlertItem {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  deviceId?: string;
  deviceName?: string;
  siteId?: string;
  siteName?: string;
  timestamp: string;
  acknowledged: boolean;
}

// ─── SmartVision IAD — Monitoring ─────────────────────────────────────────────

export interface MonitoringService {
  name: string;
  status: ServiceStatus;
  cpuPercent: number;
  ramPercent: number;
  latencyMs: number;
  uptimeSeconds: number;
  version?: string;
  endpoint?: string;
}

// ─── SmartVision IAD — Reports ────────────────────────────────────────────────

export type ReportPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface ReportFilter {
  period: ReportPeriod;
  siteId?: string;
  from?: string;
  to?: string;
}

export interface ReportRow {
  date: string;
  visitors: number;
  avgWaitTime: number;
  peakHour: string;
  malePercent: number;
  femalePercent: number;
}

// ─── SmartVision IAD — User / Profile ────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  siteId?: string | null;
  createdAt: string;
  lastLogin?: string;
}

// ─── SmartVision IAD — Settings ──────────────────────────────────────────────

export interface AppSettings {
  mqtt: {
    host: string;
    port: number;
    username: string;
    password: string;
    websocketPort: number;
  };
  camera: {
    fps: number;
    confidenceThreshold: number;
    detectionInterval: number;
  };
  ageEstimation: {
    enableAgeEstimator: boolean;
    minimumConfidence: number;
  };
  tracking: {
    enableTracking: boolean;
    trackerTimeout: number;
  };
  dashboard: {
    refreshRate: number;
    darkMode: boolean;
  };
  notifications: {
    email: boolean;
    mqtt: boolean;
    websocket: boolean;
  };
}
