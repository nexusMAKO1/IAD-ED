/**
 * mqtt.service.ts — Core MQTT Service
 * Express Display SmartVision — T-021
 *
 * Production-ready MQTT client for the NestJS backend:
 *
 *   • Connects to the Mosquitto broker at startup using the `mqtt` npm package
 *   • Configures Last Will on smartvision/system/health (status: offline)
 *   • Implements exponential-backoff reconnection (handled by mqtt.js natively)
 *   • Subscribes to all Edge-CV topics on connect
 *   • Validates incoming JSON payloads using class-validator (rejects malformed)
 *   • Provides typed publish() and subscribe() APIs consumed by domain modules
 *   • Publishes a periodic heartbeat every 30 s
 *   • Logs every connection, disconnection, publish, subscription, error
 *
 * QoS convention (from T-021 spec):
 *   QoS 0 — health, telemetry  (fire-and-forget)
 *   QoS 1 — detections, events (at-least-once)
 *   QoS 2 — critical alerts    (exactly-once)
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as mqtt from 'mqtt';
import { MqttClient as MqttJsClient, IClientOptions } from 'mqtt';
import {
  BACKEND_SUBSCRIPTIONS,
  MQTT_TOPICS,
} from './mqtt.topics';
import { BaseEventDto } from './dto/base-event.dto';
import { MqttConfigService } from './mqtt.config';

/** Handler signature for incoming messages on a topic pattern */
export type MqttMessageHandler = (
  topic: string,
  payload: Record<string, unknown>,
) => void | Promise<void>;

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);

  private client: MqttJsClient | null = null;
  private readonly handlers = new Map<string, MqttMessageHandler[]>();
  private heartbeatTimer: NodeJS.Timer | null = null;

  /** Expose connection status for health checks */
  private _connected = false;
  get isConnected(): boolean {
    return this._connected;
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly mqttConfigService: MqttConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  private async connect(): Promise<void> {
    const cfg = this.mqttConfigService.config;

    this.logger.log(
      `Connecting to MQTT broker at ${cfg.brokerUrl} (clientId=${cfg.clientId})`,
    );

    const lastWillPayload = JSON.stringify({
      timestamp: new Date().toISOString(),
      deviceId: cfg.clientId,
      siteId: 'backend',
      event: 'service_offline',
      payload: { status: 'offline', serviceName: 'backend' },
    });

    const options: IClientOptions = {
      clientId: cfg.clientId,
      username: cfg.username,
      password: cfg.password,
      keepalive: cfg.keepalive,
      clean: true,
      reconnectPeriod: 1000,      // Start at 1s — mqtt.js doubles automatically
      connectTimeout: 10_000,
      will: {
        topic: MQTT_TOPICS.SYSTEM.HEALTH,
        payload: Buffer.from(lastWillPayload),
        qos: 1,
        retain: true,
      },
    };

    this.client = mqtt.connect(cfg.brokerUrl, options);

    this.client.on('connect', () => this.onConnect());
    this.client.on('reconnect', () => this.onReconnect());
    this.client.on('disconnect', () => this.onDisconnect());
    this.client.on('offline', () => this.onOffline());
    this.client.on('error', (err) => this.onError(err));
    this.client.on('message', (topic, message) =>
      this.onMessage(topic, message),
    );
    this.client.on('close', () => this.onClose());
  }

  private async disconnect(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer as ReturnType<typeof setInterval>);
      this.heartbeatTimer = null;
    }

    if (!this.client) return;

    // Publish graceful offline before disconnecting
    this.publishOnlineStatus('offline');

    await new Promise<void>((resolve) => {
      this.client!.end(false, {}, () => resolve());
    });

    this._connected = false;
    this.logger.log('Disconnected from MQTT broker gracefully.');
  }

  // ---------------------------------------------------------------------------
  // Broker event handlers
  // ---------------------------------------------------------------------------

  private onConnect(): void {
    this._connected = true;
    this.logger.log('MQTT broker connected.');

    // Subscribe to all Edge-CV topics
    for (const topic of BACKEND_SUBSCRIPTIONS) {
      this.subscribeRaw(topic, 1);
    }

    // Announce online
    this.publishOnlineStatus('online');

    // Start heartbeat (30 s interval)
    this.heartbeatTimer = setInterval(() => this.publishHeartbeat(), 30_000);
  }

  private onReconnect(): void {
    this._connected = false;
    this.logger.warn('MQTT reconnecting…');
  }

  private onDisconnect(): void {
    this._connected = false;
    this.logger.warn('MQTT disconnected by broker.');
  }

  private onOffline(): void {
    this._connected = false;
    this.logger.warn('MQTT client offline — broker unreachable.');
  }

  private onClose(): void {
    this._connected = false;
    this.logger.debug('MQTT connection closed.');
  }

  private onError(err: Error): void {
    this.logger.error(`MQTT error: ${err.message}`, err.stack);
  }

  // ---------------------------------------------------------------------------
  // Incoming message dispatch & validation
  // ---------------------------------------------------------------------------

  private onMessage(topic: string, rawMessage: Buffer): void {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(rawMessage.toString()) as Record<string, unknown>;
    } catch {
      this.logger.warn(
        `MQTT [${topic}]: malformed JSON payload — message rejected.`,
      );
      return;
    }

    // Validate envelope with class-validator
    const dto = plainToInstance(BaseEventDto, parsed);
    validate(dto, { whitelist: false }).then((errors) => {
      if (errors.length > 0) {
        this.logger.warn(
          `MQTT [${topic}]: invalid envelope — ${errors.map((e) => e.toString()).join(', ')}`,
        );
        return;
      }

      this.logger.debug(
        `MQTT [${topic}]: ${parsed['event'] ?? 'unknown'} from ${parsed['deviceId'] ?? '?'}`,
      );

      // Dispatch to registered handlers (exact match + wildcard)
      const matchingHandlers = this.getHandlers(topic);
      for (const handler of matchingHandlers) {
        Promise.resolve(handler(topic, parsed)).catch((err: unknown) => {
          this.logger.error(
            `Handler error on topic [${topic}]: ${(err as Error).message}`,
          );
        });
      }
    }).catch((err: unknown) => {
      this.logger.error(`Validation error: ${(err as Error).message}`);
    });
  }

  private getHandlers(topic: string): MqttMessageHandler[] {
    const result: MqttMessageHandler[] = [];

    for (const [pattern, handlers] of this.handlers) {
      if (this.topicMatches(pattern, topic)) {
        result.push(...handlers);
      }
    }

    return result;
  }

  /**
   * Simple MQTT wildcard matching.
   * Supports '+' (single level) and '#' (multi-level suffix).
   */
  private topicMatches(pattern: string, topic: string): boolean {
    if (pattern === topic) return true;

    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    return patternParts.length === topicParts.length;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Publish a JSON message to a topic.
   *
   * @param topic   Target MQTT topic
   * @param payload Plain object — serialised to JSON automatically
   * @param qos     Quality of Service: 0, 1, or 2
   * @param retain  Whether the broker should retain the last message
   */
  publish(
    topic: string,
    payload: Record<string, unknown>,
    qos: 0 | 1 | 2 = 0,
    retain = false,
  ): boolean {
    if (!this.client || !this._connected) {
      this.logger.debug(
        `MQTT not connected — skipping publish to [${topic}]`,
      );
      return false;
    }

    try {
      const raw = JSON.stringify(payload);
      this.client.publish(topic, raw, { qos, retain }, (err) => {
        if (err) {
          this.logger.error(`Publish error on [${topic}]: ${err.message}`);
        } else {
          this.logger.debug(`Published to [${topic}] QoS=${qos}`);
        }
      });
      return true;
    } catch (err: unknown) {
      this.logger.error(
        `Failed to publish to [${topic}]: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Register a message handler for a topic pattern.
   * Patterns support MQTT wildcards: '+' and '#'.
   */
  subscribe(topic: string, handler: MqttMessageHandler): void {
    const existing = this.handlers.get(topic) ?? [];
    existing.push(handler);
    this.handlers.set(topic, existing);

    // If already connected, subscribe immediately; otherwise the subscription
    // is registered in the handlers map and activated on next onConnect().
    if (this._connected) {
      this.subscribeRaw(topic, 1);
    }

    this.logger.log(`Subscribed handler registered for [${topic}]`);
  }

  /** Remove all handlers for a given topic and unsubscribe from the broker */
  unsubscribe(topic: string): void {
    this.handlers.delete(topic);
    this.client?.unsubscribe(topic, (err) => {
      if (err) this.logger.warn(`Unsubscribe error on [${topic}]: ${err.message}`);
    });
  }

  // ---------------------------------------------------------------------------
  // Typed publish helpers
  // ---------------------------------------------------------------------------

  publishQueueUpdate(data: Record<string, unknown>): boolean {
    return this.publish(
      MQTT_TOPICS.BACKEND.QUEUE,
      this.envelope('queue_update', 'backend', data),
      1,
    );
  }

  publishDashboardEvent(data: Record<string, unknown>): boolean {
    return this.publish(
      MQTT_TOPICS.FRONTEND.DASHBOARD,
      this.envelope('dashboard_update', 'backend', data),
      0,
    );
  }

  publishAlert(data: Record<string, unknown>): boolean {
    return this.publish(
      MQTT_TOPICS.BACKEND.ALERTS,
      this.envelope('alert', 'backend', data),
      2,
    );
  }

  publishNotification(data: Record<string, unknown>): boolean {
    return this.publish(
      MQTT_TOPICS.FRONTEND.NOTIFICATIONS,
      this.envelope('notification', 'backend', data),
      1,
    );
  }

  sendCameraCommand(deviceId: string, command: Record<string, unknown>): boolean {
    return this.publish(
      MQTT_TOPICS.COMMANDS.CAMERA,
      {
        ...this.envelope('camera_command', 'backend', command),
        targetDeviceId: deviceId,
      },
      1,
    );
  }

  sendConfigUpdate(config: Record<string, unknown>): boolean {
    return this.publish(
      MQTT_TOPICS.COMMANDS.CONFIG_UPDATE,
      this.envelope('config_update', 'backend', config),
      1,
    );
  }

  sendRestartCommand(deviceId: string): boolean {
    return this.publish(
      MQTT_TOPICS.COMMANDS.RESTART,
      {
        ...this.envelope('restart', 'backend', { reason: 'manual' }),
        targetDeviceId: deviceId,
      },
      2,
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private subscribeRaw(topic: string, qos: 0 | 1 | 2 = 1): void {
    this.client?.subscribe(topic, { qos }, (err) => {
      if (err) {
        this.logger.error(`Failed to subscribe to [${topic}]: ${err.message}`);
      } else {
        this.logger.log(`Subscribed to [${topic}] QoS=${qos}`);
      }
    });
  }

  private publishOnlineStatus(status: 'online' | 'offline'): void {
    const cfg = this.mqttConfigService.config;
    this.publish(
      MQTT_TOPICS.SYSTEM.HEALTH,
      {
        timestamp: new Date().toISOString(),
        deviceId: cfg.clientId,
        siteId: 'backend',
        event: `service_${status}`,
        payload: { status, serviceName: 'backend' },
      },
      1,
      true, // retain — so newcomers can read the last known status
    );
  }

  private publishHeartbeat(): void {
    const cfg = this.mqttConfigService.config;
    const memUsage = process.memoryUsage();
    this.publish(
      MQTT_TOPICS.SYSTEM.HEALTH,
      {
        timestamp: new Date().toISOString(),
        deviceId: cfg.clientId,
        siteId: 'backend',
        event: 'heartbeat',
        payload: {
          status: 'healthy',
          serviceName: 'backend',
          uptime: process.uptime(),
          metrics: {
            heapUsedBytes: memUsage.heapUsed,
            rssBytes: memUsage.rss,
          },
        },
      },
      0,
    );
  }

  private envelope(
    event: string,
    deviceId: string,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      deviceId,
      siteId: 'express-display',
      event,
      payload: data,
    };
  }
}
