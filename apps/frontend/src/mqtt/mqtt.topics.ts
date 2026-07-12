/**
 * mqtt.topics.ts — Shared MQTT Topic Constants (Frontend)
 * Express Display SmartVision — T-021
 *
 * Mirrors the Backend's mqtt.topics.ts exactly.
 * The Frontend subscribes via WebSocket to topics listed in FRONTEND_SUBSCRIPTIONS.
 */

export const MQTT_TOPICS = {
  EDGE: {
    DETECTIONS: 'smartvision/edge/detections',
    TRACKING: 'smartvision/edge/tracking',
    DEMOGRAPHICS: 'smartvision/edge/demographics',
    CROWD_DENSITY: 'smartvision/edge/crowd-density',
    PERFORMANCE: 'smartvision/edge/performance',
    CAMERA_HEALTH: 'smartvision/edge/camera-health',
    STATUS: 'smartvision/edge/status',
  },
  BACKEND: {
    EVENTS: 'smartvision/backend/events',
    ALERTS: 'smartvision/backend/alerts',
    QUEUE: 'smartvision/backend/queue',
    ANALYTICS: 'smartvision/backend/analytics',
    CAMPAIGNS: 'smartvision/backend/campaigns',
  },
  DISPLAY: {
    PLAY: 'smartvision/display/play',
    PLAYLIST: 'smartvision/display/playlist',
    CACHE: 'smartvision/display/cache',
    STATUS: 'smartvision/display/status',
    CURRENT: 'smartvision/display/current',
  },
  FRONTEND: {
    DASHBOARD: 'smartvision/frontend/dashboard',
    NOTIFICATIONS: 'smartvision/frontend/notifications',
  },
  SYSTEM: {
    HEALTH: 'smartvision/system/health',
    LOGS: 'smartvision/system/logs',
  },
} as const;

/** Topics the Frontend subscribes to on startup */
export const FRONTEND_SUBSCRIPTIONS = [
  MQTT_TOPICS.FRONTEND.DASHBOARD,
  MQTT_TOPICS.FRONTEND.NOTIFICATIONS,
  MQTT_TOPICS.BACKEND.EVENTS,
  MQTT_TOPICS.BACKEND.ALERTS,
  MQTT_TOPICS.BACKEND.QUEUE,
  MQTT_TOPICS.EDGE.DETECTIONS,
  MQTT_TOPICS.EDGE.TRACKING,
  MQTT_TOPICS.EDGE.DEMOGRAPHICS,
  MQTT_TOPICS.EDGE.CROWD_DENSITY,
  MQTT_TOPICS.EDGE.PERFORMANCE,
  MQTT_TOPICS.EDGE.CAMERA_HEALTH,
  MQTT_TOPICS.SYSTEM.HEALTH,
] as const;
