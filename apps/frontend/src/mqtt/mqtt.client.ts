/**
 * mqtt.client.ts — Singleton MQTT Client (WebSocket)
 * Express Display SmartVision — T-021
 *
 * Connects to the Mosquitto broker over WebSocket using the mqtt.js library.
 *
 * Features:
 *   - Reads broker URL and credentials from Vite env vars (never hardcoded)
 *   - Skips connection entirely when credentials are absent or MQTT is disabled
 *   - Detects "Not authorized" and stops retrying permanently (no more spam)
 *   - Exponential back-off: starts at 1s, doubles each attempt, caps at 60s
 *   - Last Will on smartvision/system/health (status: offline)
 *   - JSON payload validation with envelope shape check
 *   - Handler registration per topic (exact + wildcard)
 *   - Typed publish API
 *   - Connection status observable via callbacks
 *   - Comprehensive logging (single line per event — no spam)
 *
 * Environment variables (set in .env):
 *   VITE_MQTT_WS_URL       — e.g. ws://localhost:9003
 *   VITE_MQTT_USERNAME     — broker username (REQUIRED for Mosquitto auth)
 *   VITE_MQTT_PASSWORD     — broker password (REQUIRED for Mosquitto auth)
 *   VITE_MQTT_CLIENT_ID    — client identifier (default: frontend-<random>)
 *   VITE_SITE_ID           — site identifier (default: express-display)
 *   VITE_MQTT_ENABLED      — set to 'false' to disable MQTT entirely (default: 'true')
 */

import mqtt, { MqttClient as MqttJsClient, IClientOptions } from 'mqtt';
import { FRONTEND_SUBSCRIPTIONS, MQTT_TOPICS } from './mqtt.topics';
import type { BaseEvent, MqttHandler } from './mqtt.types';

// ---------------------------------------------------------------------------
// Configuration — read from Vite env vars
// ---------------------------------------------------------------------------

const BROKER_URL =
  import.meta.env.VITE_MQTT_WS_URL ?? 'ws://localhost:9003';

const USERNAME = (import.meta.env.VITE_MQTT_USERNAME as string | undefined) ?? '';
const PASSWORD = (import.meta.env.VITE_MQTT_PASSWORD as string | undefined) ?? '';
const SITE_ID = (import.meta.env.VITE_SITE_ID as string | undefined) ?? 'express-display';
const CLIENT_ID =
  (import.meta.env.VITE_MQTT_CLIENT_ID as string | undefined) ??
  `frontend-${Math.random().toString(16).slice(2, 8)}`;

// Kill-switch: set VITE_MQTT_ENABLED=false to disable completely.
const MQTT_ENABLED = import.meta.env.VITE_MQTT_ENABLED !== 'false';

// ---------------------------------------------------------------------------
// Exponential back-off constants
// ---------------------------------------------------------------------------

const RECONNECT_MIN_MS = 1_000;   // 1 second
const RECONNECT_MAX_MS = 60_000;  // 60 seconds
const RECONNECT_MULTIPLIER = 2;

// ---------------------------------------------------------------------------
// Logging helper — single prefix, no spam
// ---------------------------------------------------------------------------

const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.info(`[MQTT] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`[MQTT] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`[MQTT] ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) =>
    console.debug(`[MQTT] ${msg}`, ...args),
};

// ---------------------------------------------------------------------------
// Connection status callbacks
// ---------------------------------------------------------------------------

export type MqttConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';
type ConnectionCallback = (state: MqttConnectionState) => void;

// ---------------------------------------------------------------------------
// MqttClientService
// ---------------------------------------------------------------------------

class MqttClientService {
  private client: MqttJsClient | null = null;
  private readonly handlers = new Map<
    string,
    Array<MqttHandler>
  >();
  private connectionCallbacks: ConnectionCallback[] = [];
  private _state: MqttConnectionState = 'disconnected';

  // Back-off state
  private _authFailed = false;        // permanently stop retries on auth error
  private _reconnectDelay = RECONNECT_MIN_MS;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  get isConnected(): boolean {
    return this._state === 'connected';
  }

  get state(): MqttConnectionState {
    return this._state;
  }

  get isAuthFailed(): boolean {
    return this._authFailed;
  }

  // -------------------------------------------------------------------------
  // Connect
  // -------------------------------------------------------------------------

  connect(): void {
    // Guard: MQTT disabled by env flag
    if (!MQTT_ENABLED) {
      log.info('MQTT disabled (VITE_MQTT_ENABLED=false) — skipping connection.');
      return;
    }

    // Guard: no credentials — broker requires auth, skip to avoid spam
    if (!USERNAME || !PASSWORD) {
      log.warn(
        'MQTT credentials missing (VITE_MQTT_USERNAME / VITE_MQTT_PASSWORD not set). ' +
        'Connection skipped to prevent "Not authorized" spam. ' +
        'Set these variables in your .env file.',
      );
      return;
    }

    // Guard: already connecting / connected
    if (this.client) {
      log.debug('connect() called but client already exists — skipping.');
      return;
    }

    // Guard: auth failure is permanent — do not retry
    if (this._authFailed) {
      log.error('MQTT auth permanently failed — will not reconnect. Check broker credentials.');
      return;
    }

    log.info(`Connecting to ${BROKER_URL} as ${CLIENT_ID} (user=${USERNAME})`);

    const lastWill = JSON.stringify({
      timestamp: new Date().toISOString(),
      deviceId: CLIENT_ID,
      siteId: SITE_ID,
      event: 'service_offline',
      payload: { status: 'offline', serviceName: 'frontend' },
    });

    // We manage reconnection manually to implement exponential back-off with
    // auth-error detection. Set reconnectPeriod=0 to disable mqtt.js auto-retry.
    const options: IClientOptions = {
      clientId: CLIENT_ID,
      username: USERNAME,
      password: PASSWORD,
      keepalive: 60,
      clean: true,
      reconnectPeriod: 0,        // We manage reconnection ourselves
      connectTimeout: 10_000,
      will: {
        topic: MQTT_TOPICS.SYSTEM.HEALTH,
        payload: lastWill,
        qos: 1,
        retain: true,
      },
    };

    this._state = 'connecting';
    this.notifyConnectionCallbacks();

    this.client = mqtt.connect(BROKER_URL, options);

    this.client.on('connect', () => this.onConnect());
    this.client.on('reconnect', () => this.onReconnect());
    this.client.on('disconnect', () => this.onDisconnect());
    this.client.on('offline', () => this.onOffline());
    this.client.on('error', (err) => this.onError(err));
    this.client.on('message', (topic, message) =>
      this.onMessage(topic, message),
    );
    this.client.on('close', () => {
      log.debug('Connection closed.');
      // Trigger manual reconnect if not auth-failed
      this.scheduleReconnect();
    });
  }

  // -------------------------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------------------------

  disconnect(): void {
    // Cancel any pending reconnect timer
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (!this.client) return;

    // Graceful offline announcement
    this.publish(
      MQTT_TOPICS.SYSTEM.HEALTH,
      {
        timestamp: new Date().toISOString(),
        deviceId: CLIENT_ID,
        siteId: SITE_ID,
        event: 'service_offline',
        payload: { status: 'offline', serviceName: 'frontend' },
      },
      1,
      true,
    );

    this.client.end(false, {}, () => {
      log.info('Disconnected from broker.');
    });

    this.client = null;
    this._state = 'disconnected';
    this._reconnectDelay = RECONNECT_MIN_MS;
    this.notifyConnectionCallbacks();
  }

  // -------------------------------------------------------------------------
  // Public API — subscribe
  // -------------------------------------------------------------------------

  /**
   * Register a handler for a topic pattern.
   * Wildcards '+' (single-level) and '#' (multi-level) are supported.
   */
  subscribe<T extends BaseEvent = BaseEvent>(
    topic: string,
    handler: MqttHandler<T>,
  ): () => void {
    const existing = this.handlers.get(topic) ?? [];
    existing.push(handler as MqttHandler);
    this.handlers.set(topic, existing);

    if (this.isConnected && this.client) {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) log.error(`Subscribe error [${topic}]: ${err.message}`);
        else log.info(`Subscribed to [${topic}]`);
      });
    }

    // Return unsubscribe callback
    return () => {
      const current = this.handlers.get(topic) ?? [];
      const updated = current.filter((h) => h !== (handler as MqttHandler));
      if (updated.length === 0) {
        this.handlers.delete(topic);
        this.client?.unsubscribe(topic);
      } else {
        this.handlers.set(topic, updated);
      }
    };
  }

  // -------------------------------------------------------------------------
  // Public API — publish
  // -------------------------------------------------------------------------

  /**
   * Publish a JSON payload to a topic.
   *
   * @param topic   Target MQTT topic
   * @param payload Plain object — serialised to JSON
   * @param qos     Quality of Service: 0, 1, or 2
   * @param retain  Whether the broker retains the message
   */
  publish(
    topic: string,
    payload: Record<string, unknown>,
    qos: 0 | 1 | 2 = 0,
    retain = false,
  ): boolean {
    if (!this.client || this._state !== 'connected') {
      log.warn(`Not connected — skipping publish to [${topic}]`);
      return false;
    }

    try {
      const raw = JSON.stringify(payload);
      this.client.publish(topic, raw, { qos, retain }, (err) => {
        if (err) log.error(`Publish error [${topic}]: ${err.message}`);
        else log.debug(`Published to [${topic}] QoS=${qos}`);
      });
      return true;
    } catch (err: unknown) {
      log.error(`Failed to publish to [${topic}]: ${(err as Error).message}`);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Connection status observability
  // -------------------------------------------------------------------------

  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.push(callback);
    // Immediately fire with current state
    callback(this._state);
    return () => {
      this.connectionCallbacks = this.connectionCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  // -------------------------------------------------------------------------
  // Broker event handlers
  // -------------------------------------------------------------------------

  private onConnect(): void {
    this._state = 'connected';
    this._authFailed = false;
    this._reconnectDelay = RECONNECT_MIN_MS;  // Reset back-off on success
    log.info(`Connected to ${BROKER_URL}`);
    this.notifyConnectionCallbacks();

    // Subscribe to all frontend topics
    for (const topic of FRONTEND_SUBSCRIPTIONS) {
      this.client?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) log.error(`Subscribe error [${topic}]: ${err.message}`);
        else log.info(`Subscribed to [${topic}]`);
      });
    }

    // Announce online
    this.publish(
      MQTT_TOPICS.SYSTEM.HEALTH,
      {
        timestamp: new Date().toISOString(),
        deviceId: CLIENT_ID,
        siteId: SITE_ID,
        event: 'service_online',
        payload: { status: 'online', serviceName: 'frontend' },
      },
      1,
      true,
    );
  }

  private onReconnect(): void {
    this._state = 'connecting';
    log.warn('Reconnecting…');
    this.notifyConnectionCallbacks();
  }

  private onDisconnect(): void {
    this._state = 'disconnected';
    log.warn('Disconnected by broker.');
    this.notifyConnectionCallbacks();
  }

  private onOffline(): void {
    this._state = 'disconnected';
    log.warn('Client offline — broker unreachable.');
    this.notifyConnectionCallbacks();
  }

  private onError(err: Error): void {
    const msg = err.message ?? String(err);

    // -----------------------------------------------------------------------
    // CRITICAL: Detect permanent auth failure — STOP ALL RETRIES immediately
    // -----------------------------------------------------------------------
    const isAuthError =
      msg.includes('Not authorized') ||
      msg.includes('Connection refused') ||
      msg.includes('Bad username or password') ||
      msg.includes('CONNACK returncod=5') ||  // MQTT return code 5 = auth refused
      (err as unknown as Record<string, unknown>)['code'] === 5;

    if (isAuthError) {
      this._authFailed = true;
      this._state = 'error';

      // Cancel pending reconnect timer
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }

      // Destroy client immediately to stop mqtt.js internal retries
      if (this.client) {
        this.client.end(true);  // force=true — no grace period
        this.client = null;
      }

      log.error(
        `[MQTT FAILURE] broker=${BROKER_URL} | username=${USERNAME || '<empty>'} | error=${msg}\n` +
        'MQTT authentication failed. Reconnection stopped permanently. ' +
        'Check VITE_MQTT_USERNAME / VITE_MQTT_PASSWORD in your .env and the Mosquitto passwd file.',
      );

      this.notifyConnectionCallbacks();
      return;
    }

    // Non-auth error — log once (reconnect will be handled by 'close' event)
    log.error(`[MQTT FAILURE] broker=${BROKER_URL} | username=${USERNAME || '<empty>'} | error=${msg}`);
  }

  // -------------------------------------------------------------------------
  // Manual exponential back-off reconnection
  // -------------------------------------------------------------------------

  private scheduleReconnect(): void {
    // Never reconnect if auth permanently failed
    if (this._authFailed) return;

    // Never reconnect if client was explicitly disconnected
    if (!this.client && !this._authFailed) {
      // Client was destroyed by disconnect() — do not auto-reconnect
      return;
    }

    // Destroy stale client before creating a new one
    if (this.client) {
      this.client.removeAllListeners();
      this.client = null;
    }

    this._state = 'connecting';
    this.notifyConnectionCallbacks();

    const delay = this._reconnectDelay;
    this._reconnectDelay = Math.min(
      delay * RECONNECT_MULTIPLIER,
      RECONNECT_MAX_MS,
    );

    log.warn(`Reconnecting in ${delay / 1000}s (next: ${this._reconnectDelay / 1000}s max)`);

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, delay);
  }

  // -------------------------------------------------------------------------
  // Incoming message dispatch & validation
  // -------------------------------------------------------------------------

  private onMessage(topic: string, rawMessage: Buffer): void {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(rawMessage.toString()) as Record<string, unknown>;
    } catch {
      log.warn(`[${topic}]: malformed JSON — message rejected.`);
      return;
    }

    // Topics published by the backend for frontend consumption use a different
    // shape than device event envelopes. They don't carry siteId/event fields.
    // Pass them through directly without the strict envelope check.
    const isSystemTopic =
      topic.startsWith('smartvision/frontend/') ||
      topic.startsWith('smartvision/system/');

    if (!isSystemTopic) {
      // Validate standard device event envelope shape
      if (
        typeof parsed['timestamp'] !== 'string' ||
        typeof parsed['deviceId'] !== 'string' ||
        typeof parsed['siteId'] !== 'string' ||
        typeof parsed['event'] !== 'string'
      ) {
        log.warn(`[${topic}]: invalid envelope shape — message rejected.`);
        return;
      }
    }

    log.debug(`[${topic}]: received from ${String(parsed['deviceId'] ?? 'system')}`);

    // Dispatch to handlers (exact match + wildcard)
    for (const [pattern, handlers] of this.handlers) {
      if (this.topicMatches(pattern, topic)) {
        for (const handler of handlers) {
          try {
            handler(topic, parsed as unknown as BaseEvent);
          } catch (err: unknown) {
            log.error(
              `Handler error on [${topic}]: ${(err as Error).message}`,
            );
          }
        }
      }
    }
  }

  /**
   * Simple MQTT wildcard matching.
   * Supports '+' (single level) and '#' (multi-level suffix).
   */
  private topicMatches(pattern: string, topic: string): boolean {
    if (pattern === topic) return true;

    const pp = pattern.split('/');
    const tp = topic.split('/');

    for (let i = 0; i < pp.length; i++) {
      if (pp[i] === '#') return true;
      if (pp[i] !== '+' && pp[i] !== tp[i]) return false;
    }

    return pp.length === tp.length;
  }

  private notifyConnectionCallbacks(): void {
    for (const cb of this.connectionCallbacks) {
      try {
        cb(this._state);
      } catch {
        // ignore callback errors
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

export const mqttClient = new MqttClientService();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    log.info('HMR reload detected, disconnecting MQTT client...');
    mqttClient.disconnect();
  });
}
