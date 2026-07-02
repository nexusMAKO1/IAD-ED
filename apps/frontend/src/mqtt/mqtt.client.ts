/**
 * mqtt.client.ts — Singleton MQTT Client (WebSocket)
 * Express Display SmartVision — T-021
 *
 * Connects to the Mosquitto broker over WebSocket using the mqtt.js library.
 *
 * Features:
 *   - Reads broker URL and credentials from Vite env vars (never hardcoded)
 *   - Last Will on smartvision/system/health (status: offline)
 *   - Automatic reconnection with exponential back-off (mqtt.js native)
 *   - JSON payload validation with envelope shape check
 *   - Handler registration per topic (exact + wildcard)
 *   - Typed publish API
 *   - Connection status observable via callbacks
 *   - Comprehensive logging
 *
 * Environment variables (set in .env or docker-compose):
 *   VITE_MQTT_WS_URL       — e.g. ws://localhost:9003
 *   VITE_MQTT_USERNAME     — broker username
 *   VITE_MQTT_PASSWORD     — broker password (keep in .env, never commit)
 *   VITE_MQTT_CLIENT_ID    — client identifier (default: frontend-<random>)
 *   VITE_SITE_ID           — site identifier (default: express-display)
 */

import mqtt, { MqttClient as MqttJsClient, IClientOptions } from 'mqtt';
import { FRONTEND_SUBSCRIPTIONS, MQTT_TOPICS } from './mqtt.topics';
import type { BaseEvent, MqttHandler } from './mqtt.types';

// ---------------------------------------------------------------------------
// Configuration — read from Vite env vars
// ---------------------------------------------------------------------------

const BROKER_URL =
  import.meta.env.VITE_MQTT_WS_URL ?? 'ws://localhost:9003';

const USERNAME = import.meta.env.VITE_MQTT_USERNAME ?? '';
const PASSWORD = import.meta.env.VITE_MQTT_PASSWORD ?? '';
const SITE_ID = import.meta.env.VITE_SITE_ID ?? 'express-display';
const CLIENT_ID =
  import.meta.env.VITE_MQTT_CLIENT_ID ??
  `frontend-${Math.random().toString(16).slice(2, 8)}`;

// ---------------------------------------------------------------------------
// Logging helper
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

type ConnectionCallback = (connected: boolean) => void;

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
  private _connected = false;

  get isConnected(): boolean {
    return this._connected;
  }

  // -------------------------------------------------------------------------
  // Connect
  // -------------------------------------------------------------------------

  connect(): void {
    if (this.client) {
      log.warn('connect() called but client already exists — skipping.');
      return;
    }

    log.info(`Connecting to ${BROKER_URL} as ${CLIENT_ID}`);

    const lastWill = JSON.stringify({
      timestamp: new Date().toISOString(),
      deviceId: CLIENT_ID,
      siteId: SITE_ID,
      event: 'service_offline',
      payload: { status: 'offline', serviceName: 'frontend' },
    });

    const options: IClientOptions = {
      clientId: CLIENT_ID,
      username: USERNAME || undefined,
      password: PASSWORD || undefined,
      keepalive: 60,
      clean: true,
      reconnectPeriod: 2000,   // 2s initial — mqtt.js doubles automatically
      connectTimeout: 10_000,
      will: {
        topic: MQTT_TOPICS.SYSTEM.HEALTH,
        payload: lastWill,
        qos: 1,
        retain: true,
      },
    };

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
    });
  }

  // -------------------------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------------------------

  disconnect(): void {
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

    this._connected = false;
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

    if (this._connected && this.client) {
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
    if (!this.client || !this._connected) {
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
    callback(this._connected);
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
    this._connected = true;
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
    this._connected = false;
    log.warn('Reconnecting…');
    this.notifyConnectionCallbacks();
  }

  private onDisconnect(): void {
    this._connected = false;
    log.warn('Disconnected by broker.');
    this.notifyConnectionCallbacks();
  }

  private onOffline(): void {
    this._connected = false;
    log.warn('Client offline — broker unreachable.');
    this.notifyConnectionCallbacks();
  }

  private onError(err: Error): void {
    log.error(`MQTT error: ${err.message}`);
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

    // Validate envelope shape
    if (
      typeof parsed['timestamp'] !== 'string' ||
      typeof parsed['deviceId'] !== 'string' ||
      typeof parsed['siteId'] !== 'string' ||
      typeof parsed['event'] !== 'string'
    ) {
      log.warn(`[${topic}]: invalid envelope shape — message rejected.`);
      return;
    }

    log.debug(`[${topic}]: ${parsed['event']} from ${parsed['deviceId']}`);

    // Dispatch to handlers (exact match + wildcard)
    for (const [pattern, handlers] of this.handlers) {
      if (this.topicMatches(pattern, topic)) {
        for (const handler of handlers) {
          try {
            handler(topic, parsed as BaseEvent);
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
        cb(this._connected);
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
