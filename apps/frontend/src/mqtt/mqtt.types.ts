/**
 * mqtt.types.ts — TypeScript Interfaces for MQTT Payloads
 * Express Display SmartVision — T-021
 */

// ---------------------------------------------------------------------------
// Base envelope (matches Python BaseEvent / NestJS BaseEventDto)
// ---------------------------------------------------------------------------
export interface BaseEvent {
  timestamp: string;   // ISO-8601 UTC
  deviceId: string;
  siteId: string;
  event: string;
  payload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Detection payload (smartvision/edge/detections)
// ---------------------------------------------------------------------------
export interface DetectionBoundingBox {
  trackId?: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  label?: string;
  estimatedAge?: number | null;
  ageGroup?: string | null;
}

export interface DetectionPayload extends BaseEvent {
  payload: {
    personCount: number;
    inferenceMsec: number;
    processingMsec: number;
    detections: DetectionBoundingBox[];
  };
}

// ---------------------------------------------------------------------------
// Tracking payload (smartvision/edge/tracking)
// ---------------------------------------------------------------------------
export interface TrackingPayload extends BaseEvent {
  payload: {
    activeCount: number;
    trackIds: number[];
    fps: number;
  };
}

// ---------------------------------------------------------------------------
// Performance payload (smartvision/edge/performance)
// ---------------------------------------------------------------------------
export interface PerformancePayload extends BaseEvent {
  payload: {
    fps: number;
    inferenceMsec: number;
    processingMsec: number;
    cpuPercent?: number;
    memoryBytes?: number;
  };
}

// ---------------------------------------------------------------------------
// Crowd density (smartvision/edge/crowd-density)
// ---------------------------------------------------------------------------
export type DensityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CrowdDensityPayload extends BaseEvent {
  payload: {
    count: number;
    density: DensityLevel;
    zoneId?: string;
  };
}

// ---------------------------------------------------------------------------
// Camera health (smartvision/edge/camera-health)
// ---------------------------------------------------------------------------
export interface CameraHealthPayload extends BaseEvent {
  payload: {
    online: boolean;
    source: string;
    resolution?: string;
    fps?: number;
  };
}

// ---------------------------------------------------------------------------
// System health (smartvision/system/health)
// ---------------------------------------------------------------------------
export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'online' | 'offline';

export interface SystemHealthPayload extends BaseEvent {
  payload: {
    status: ServiceStatus;
    serviceName: string;
    uptime?: number;
    metrics?: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Backend events (smartvision/backend/*)
// ---------------------------------------------------------------------------
export interface QueueUpdatePayload extends BaseEvent {
  payload: {
    waitTime: number;
    queueLength: number;
    zoneId?: string;
  };
}

export interface AlertPayload extends BaseEvent {
  payload: {
    severity: 'info' | 'warning' | 'critical';
    message: string;
    code?: string;
  };
}

export interface DashboardPayload extends BaseEvent {
  payload: Record<string, unknown>;
}

export interface NotificationPayload extends BaseEvent {
  payload: {
    title: string;
    body: string;
    level?: 'info' | 'success' | 'warning' | 'error';
  };
}

// ---------------------------------------------------------------------------
// Union of all payload types (for discriminated union handlers)
// ---------------------------------------------------------------------------
export type MqttPayload =
  | DetectionPayload
  | TrackingPayload
  | PerformancePayload
  | CrowdDensityPayload
  | CameraHealthPayload
  | SystemHealthPayload
  | QueueUpdatePayload
  | AlertPayload
  | DashboardPayload
  | NotificationPayload;

/** Generic handler type for MQTT message callbacks */
export type MqttHandler<T extends BaseEvent = BaseEvent> = (
  topic: string,
  payload: T,
) => void;
