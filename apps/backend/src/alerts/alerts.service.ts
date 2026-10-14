/**
 * alerts.service.ts — Centralized Alert Service & SmartQueue Proxy
 *
 * Implements:
 *   - Durable persistence via Prisma (`alerts` table) across restarts
 *   - Bounded in-memory cache (FIFO eviction, max 500 items) for resilient fallback
 *   - Idempotent alert creation preventing duplicate alert storms
 *   - Safe concurrency handling for operator acknowledgements
 *   - Configurable SmartQueue ML proxy with resilient fallback to http://smartqueue-ml:8002
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt.topics';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

export interface AlertItem {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  deviceId?: string;
  deviceName?: string;
  siteId?: string;
  siteName?: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export const MAX_ALERT_CACHE_SIZE = 500;

@Injectable()
export class AlertsService implements OnModuleInit {
  private readonly logger = new Logger(AlertsService.name);
  private readonly cache: Map<string, AlertItem> = new Map();
  private readonly smartqueueUrl: string;

  constructor(
    private readonly mqttService: MqttService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const directUrl =
      this.configService.get<string>('SMARTQUEUE_URL') ||
      this.configService.get<string>('ML_SERVICE_URL');

    if (directUrl) {
      this.smartqueueUrl = directUrl.replace(/\/$/, '');
    } else {
      const host = this.configService.get<string>(
        'SMARTQUEUE_HOST',
        'smartqueue-ml',
      );
      const port = this.configService.get<string>('SMARTQUEUE_PORT', '8002');
      this.smartqueueUrl = `http://${host}:${port}`;
    }
  }

  getSmartQueueUrl(): string {
    return this.smartqueueUrl;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('AlertsService initialized. Synchronizing stored alerts and subscribing to MQTT...');

    // Warm-up cache from database to survive restarts
    try {
      const storedAlerts = await this.prisma.alert.findMany({
        take: MAX_ALERT_CACHE_SIZE,
        orderBy: { timestamp: 'desc' },
      });
      for (const a of storedAlerts) {
        this.cacheAlertLocally(this.mapPrismaToAlertItem(a));
      }
      this.logger.log(`Loaded ${storedAlerts.length} existing alerts from database into cache.`);
    } catch (err: any) {
      this.logger.warn(`Could not preload alerts from database: ${err.message}`);
    }

    this.mqttService.subscribe(
      MQTT_TOPICS.BACKEND.ALERTS,
      (_topic, data) => {
        void this.handleIncomingAlert(data);
      },
    );
  }

  private cacheAlertLocally(alert: AlertItem): void {
    // Enforce bounded cache size with FIFO eviction
    if (this.cache.size >= MAX_ALERT_CACHE_SIZE && !this.cache.has(alert.id)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(alert.id, alert);
  }

  async handleIncomingAlert(data: Record<string, any>): Promise<AlertItem | null> {
    try {
      const payload = data.payload || data;
      const alertId =
        data.id ||
        payload.id ||
        `alert-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

      const rawSeverity = (payload.severity || 'warning').toLowerCase();
      const severity: 'info' | 'warning' | 'critical' =
        rawSeverity === 'critical' || rawSeverity === 'info'
          ? rawSeverity
          : 'warning';

      const alertItem: AlertItem = {
        id: alertId,
        type: payload.type || 'system_alert',
        severity,
        message: payload.message || 'Alerte détectée',
        deviceId: data.deviceId || payload.deviceId,
        deviceName: payload.deviceName,
        siteId: data.siteId || payload.siteId,
        siteName: payload.siteName,
        timestamp: data.timestamp || new Date().toISOString(),
        acknowledged: false,
      };

      // Persist to PostgreSQL via Prisma with idempotent upsert
      try {
        const persisted = await this.prisma.alert.upsert({
          where: { id: alertItem.id },
          create: {
            id: alertItem.id,
            type: alertItem.type,
            severity: alertItem.severity,
            message: alertItem.message,
            deviceId: alertItem.deviceId,
            deviceName: alertItem.deviceName,
            siteId: alertItem.siteId,
            siteName: alertItem.siteName,
            timestamp: new Date(alertItem.timestamp),
            acknowledged: false,
          },
          update: {
            message: alertItem.message,
            severity: alertItem.severity,
          },
        });
        const mapped = this.mapPrismaToAlertItem(persisted);
        this.cacheAlertLocally(mapped);
        this.logger.warn(
          `[ALERT] Persisted alert ${mapped.id} (${mapped.severity}): ${mapped.message}`,
        );
        return mapped;
      } catch (dbErr: any) {
        this.logger.error(`Database error saving alert: ${dbErr.message}`);
        this.cacheAlertLocally(alertItem);
        return alertItem;
      }
    } catch (err: any) {
      this.logger.error(`Error processing incoming alert: ${err.message}`);
      return null;
    }
  }

  async findAll(filters?: {
    siteId?: string;
    severity?: string;
    acknowledged?: boolean;
    limit?: number;
  }): Promise<AlertItem[]> {
    const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);

    try {
      const where: any = {};
      if (filters?.siteId) where.siteId = filters.siteId;
      if (filters?.severity) where.severity = filters.severity;
      if (filters?.acknowledged !== undefined) where.acknowledged = filters.acknowledged;

      const records = await this.prisma.alert.findMany({
        where,
        take: limit,
        orderBy: { timestamp: 'desc' },
      });

      return records.map((r) => this.mapPrismaToAlertItem(r));
    } catch (err: any) {
      this.logger.warn(`Database query failed in findAll, using cache: ${err.message}`);
      let result = Array.from(this.cache.values());
      if (filters?.siteId) result = result.filter((a) => a.siteId === filters.siteId);
      if (filters?.severity) result = result.filter((a) => a.severity === filters.severity);
      if (filters?.acknowledged !== undefined) {
        result = result.filter((a) => a.acknowledged === filters.acknowledged);
      }
      result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return result.slice(0, limit);
    }
  }

  async findOne(id: string): Promise<AlertItem> {
    try {
      const record = await this.prisma.alert.findUnique({ where: { id } });
      if (record) {
        return this.mapPrismaToAlertItem(record);
      }
    } catch (err: any) {
      this.logger.warn(`Database query failed in findOne(${id}): ${err.message}`);
    }

    const cached = this.cache.get(id);
    if (!cached) {
      throw new NotFoundException(`Alerte '${id}' introuvable`);
    }
    return cached;
  }

  async acknowledge(id: string, user: JwtPayload): Promise<AlertItem> {
    const operator = user.email || user.sub;
    const now = new Date();

    let updatedAlert: AlertItem;

    try {
      const updated = await this.prisma.alert.update({
        where: { id },
        data: {
          acknowledged: true,
          acknowledgedBy: operator,
          acknowledgedAt: now,
        },
      });
      updatedAlert = this.mapPrismaToAlertItem(updated);
    } catch (dbErr: any) {
      // Check cache fallback if record not found in DB
      const cached = this.cache.get(id);
      if (!cached) {
        throw new NotFoundException(`Alerte '${id}' introuvable`);
      }
      cached.acknowledged = true;
      cached.acknowledgedBy = operator;
      cached.acknowledgedAt = now.toISOString();
      updatedAlert = cached;
    }

    this.cacheAlertLocally(updatedAlert);
    this.logger.log(
      `Alert '${id}' acknowledged by authenticated operator: ${operator}`,
    );

    // Propagate ack downstream to SmartQueue ML
    try {
      const res = await fetch(`${this.smartqueueUrl}/alerts/${id}/ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operator-Id': operator,
        },
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        this.logger.log(`Successfully propagated ack to SmartQueue ML for alert ${id}`);
      } else {
        this.logger.warn(`SmartQueue ML ack returned status ${res.status} for alert ${id}`);
      }
    } catch (err: any) {
      this.logger.warn(
        `SmartQueue ack notification not delivered for alert ${id}: ${err.message}`,
      );
    }

    return updatedAlert;
  }

  async delete(id: string): Promise<void> {
    let deletedFromDb = false;
    try {
      await this.prisma.alert.delete({ where: { id } });
      deletedFromDb = true;
    } catch {
      // If not in DB, check cache
    }

    const inCache = this.cache.has(id);
    this.cache.delete(id);

    if (!deletedFromDb && !inCache) {
      throw new NotFoundException(`Alerte '${id}' introuvable`);
    }

    this.logger.log(`Alert '${id}' deleted`);
  }

  private mapPrismaToAlertItem(record: any): AlertItem {
    return {
      id: record.id,
      type: record.type,
      severity: record.severity as 'info' | 'warning' | 'critical',
      message: record.message,
      deviceId: record.deviceId ?? undefined,
      deviceName: record.deviceName ?? undefined,
      siteId: record.siteId ?? undefined,
      siteName: record.siteName ?? undefined,
      timestamp: record.timestamp instanceof Date ? record.timestamp.toISOString() : record.timestamp,
      acknowledged: record.acknowledged,
      acknowledgedBy: record.acknowledgedBy ?? undefined,
      acknowledgedAt: record.acknowledgedAt instanceof Date ? record.acknowledgedAt.toISOString() : record.acknowledgedAt ?? undefined,
    };
  }
}
