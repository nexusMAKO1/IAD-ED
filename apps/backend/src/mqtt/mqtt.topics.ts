/**
 * mqtt.topics.ts — Shared MQTT Topic Definitions
 * Express Display SmartVision — T-021
 *
 * Centralised topic registry for the entire SmartVision MQTT hierarchy.
 * Every service (Edge-CV, Backend, Frontend) must consume these constants
 * and never hardcode topic strings.
 *
 * Hierarchy:
 *   smartvision/
 *     edge/         — published by Edge-CV
 *     backend/      — published by Backend
 *     frontend/     — consumed by Frontend (published by Backend)
 *     system/       — cross-service health & logs
 */

export const MQTT_TOPICS = {
  // ---------------------------------------------------------------------------
  // Edge-CV publishes → Backend subscribes
  // ---------------------------------------------------------------------------
  EDGE: {
    /** QoS 1 — one message per detection frame */
    DETECTIONS: 'smartvision/edge/detections',
    /** QoS 1 — active tracking IDs per frame */
    TRACKING: 'smartvision/edge/tracking',
    /** QoS 1 — age / gender demographics per person */
    DEMOGRAPHICS: 'smartvision/edge/demographics',
    /** QoS 0 — crowd density aggregates (every N seconds) */
    CROWD_DENSITY: 'smartvision/edge/crowd-density',
    /** QoS 0 — live FPS & inference latency telemetry */
    PERFORMANCE: 'smartvision/edge/performance',
    /** QoS 0 — camera availability & health */
    CAMERA_HEALTH: 'smartvision/edge/camera-health',
    /** QoS 1 — generic processing status events */
    STATUS: 'smartvision/edge/status',
  },

  // ---------------------------------------------------------------------------
  // Backend publishes → Edge-CV subscribes (commands / config)
  // ---------------------------------------------------------------------------
  COMMANDS: {
    /** QoS 1 — update model / detection configuration */
    CONFIG_UPDATE: 'smartvision/commands/config-update',
    /** QoS 1 — camera on/off, PTZ, snapshot */
    CAMERA: 'smartvision/commands/camera',
    /** QoS 1 — swap or reload YOLO model weights */
    MODEL_UPDATE: 'smartvision/commands/model-update',
    /** QoS 2 — graceful restart of the Edge-CV service */
    RESTART: 'smartvision/commands/restart',
  },

  // ---------------------------------------------------------------------------
  // Backend publishes → Display Kiosk subscribes
  // ---------------------------------------------------------------------------
  DISPLAY: {
    /** QoS 1 — commands to control ad playback */
    PLAY: 'smartvision/display/play',
    /** QoS 1 — main command channel to kiosk (play / playlist) */
    COMMANDS: 'smartvision/display/commands',
    PLAYLIST: 'smartvision/display/playlist',
    CACHE: 'smartvision/display/cache',
    /** QoS 0 — status heartbeat from the display */
    STATUS: 'smartvision/display/status',
    CURRENT: 'smartvision/display/current',
  },

  // ---------------------------------------------------------------------------
  // Backend publishes → Frontend subscribes
  // ---------------------------------------------------------------------------
  BACKEND: {
    /** QoS 1 — processed business events for dashboard */
    EVENTS: 'smartvision/backend/events',
    /** QoS 2 — critical actionable alerts */
    ALERTS: 'smartvision/backend/alerts',
    /** QoS 1 — SmartQueue position / waiting-time updates */
    QUEUE: 'smartvision/backend/queue',
    /** QoS 0 — aggregated analytics reports */
    ANALYTICS: 'smartvision/backend/analytics',
    /** QoS 1 — ad-campaign trigger events */
    CAMPAIGNS: 'smartvision/backend/campaigns',
  },

  // ---------------------------------------------------------------------------
  // Frontend-specific output topics (subscribed by Frontend via WebSocket)
  // ---------------------------------------------------------------------------
  FRONTEND: {
    /** QoS 0 — real-time dashboard metrics */
    DASHBOARD: 'smartvision/frontend/dashboard',
    /** QoS 1 — push notifications for operators */
    NOTIFICATIONS: 'smartvision/frontend/notifications',
  },

  // ---------------------------------------------------------------------------
  // System-wide cross-service topics
  // ---------------------------------------------------------------------------
  SYSTEM: {
    /** QoS 0 — heartbeat/health from all services */
    HEALTH: 'smartvision/system/health',
    /** QoS 0 — structured log events */
    LOGS: 'smartvision/system/logs',
  },
} as const;

/** All topics the Backend subscribes to from Edge-CV */
export const BACKEND_SUBSCRIPTIONS = [
  MQTT_TOPICS.EDGE.DETECTIONS,
  MQTT_TOPICS.EDGE.TRACKING,
  MQTT_TOPICS.EDGE.DEMOGRAPHICS,
  MQTT_TOPICS.EDGE.CROWD_DENSITY,
  MQTT_TOPICS.EDGE.PERFORMANCE,
  MQTT_TOPICS.EDGE.CAMERA_HEALTH,
  MQTT_TOPICS.EDGE.STATUS,
  MQTT_TOPICS.DISPLAY.STATUS,
  MQTT_TOPICS.DISPLAY.CURRENT,
  MQTT_TOPICS.SYSTEM.HEALTH,
] as const;
