/**
 * alerts.service.ts — Centralized Alert Service & SmartQueue Proxy
 * Fixes Technical Debt (T-015 / Auth: X-Operator-Id header verification)
 */

import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt.topics';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

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

@Injectable()
export class AlertsService implements OnModuleInit {
  private readonly logger = new Logger(AlertsService.name);
  private alerts: Map<string, AlertItem> = new Map();
  private readonly smartqueueUrl: string;

  constructor(
    private readonly mqttService: MqttService,
    private readonly configService: ConfigService,
  ) {
    const host = this.configService.get<string>('SMARTQUEUE_HOST', 'smartqueue');
    const port = this.configService.get<string>('SMARTQUEUE_PORT', '8000');
    this.smartqueueUrl = `http://${host}:${port}`;
  }

  onModuleInit() {
    this.logger.log('AlertsService initialized. Subscribing to alerts topic...');
    this.mqttService.subscribe(
      MQTT_TOPICS.BACKEND.ALERTS,
      (_topic, data) => this.handleIncomingAlert(data),
    );
  }

  private handleIncomingAlert(data: Record<string, any>) {
    try {
      const payload = data.payload || data;
      const alertId = data.id || payload.id || `alert-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
      const alert: AlertItem = {
        id: alertId,
        type: payload.type || 'system_alert',
        severity: payload.severity || 'warning',
        message: payload.message || 'Alerte détectée',
        deviceId: data.deviceId || payload.deviceId,
        deviceName: payload.deviceName,
        siteId: data.siteId || payload.siteId,
        siteName: payload.siteName,
        timestamp: data.timestamp || new Date().toISOString(),
        acknowledged: false,
      };

      this.alerts.set(alert.id, alert);
      this.logger.warn(`[ALERT] Ingested alert ${alert.id} (${alert.severity}): ${alert.message}`);
    } catch (err: any) {
      this.logger.error(`Error processing incoming alert: ${err.message}`);
    }
  }

  findAll(filters?: {
    siteId?: string;
    severity?: string;
    acknowledged?: boolean;
    limit?: number;
  }): AlertItem[] {
    let result = Array.from(this.alerts.values());

    if (filters?.siteId) {
      result = result.filter((a) => a.siteId === filters.siteId);
    }
    if (filters?.severity) {
      result = result.filter((a) => a.severity === filters.severity);
    }
    if (filters?.acknowledged !== undefined) {
      result = result.filter((a) => a.acknowledged === filters.acknowledged);
    }

    result.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    if (filters?.limit && filters.limit > 0) {
      result = result.slice(0, filters.limit);
    }

    return result;
  }

  findOne(id: string): AlertItem {
    const alert = this.alerts.get(id);
    if (!alert) {
      throw new NotFoundException(`Alerte '${id}' introuvable`);
    }
    return alert;
  }

  /**
   * Securely acknowledges an alert with verified operator identity from JWT.
   * Proxies downstream to SmartQueue ML using verified user email as X-Operator-Id.
   */
  async acknowledge(id: string, user: JwtPayload): Promise<AlertItem> {
    const alert = this.findOne(id);

    alert.acknowledged = true;
    alert.acknowledgedBy = user.email || user.sub;
    alert.acknowledgedAt = new Date().toISOString();

    this.logger.log(
      `Alert '${id}' acknowledged by authenticated operator: ${alert.acknowledgedBy}`,
    );

    // Forward to SmartQueue ML if applicable
    try {
      await fetch(`${this.smartqueueUrl}/alerts/${id}/ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operator-Id': alert.acknowledgedBy,
        },
        signal: AbortSignal.timeout(2000),
      });
      this.logger.log(
        `Successfully propagated ack to SmartQueue ML for alert ${id}`,
      );
    } catch (err: any) {
      // SmartQueue might be offline or alert was purely an IAD alert
      this.logger.debug(
        `SmartQueue ack notification not delivered: ${err.message}`,
      );
    }

    return alert;
  }

  delete(id: string): void {
    if (!this.alerts.has(id)) {
      throw new NotFoundException(`Alerte '${id}' introuvable`);
    }
    this.alerts.delete(id);
    this.logger.log(`Alert '${id}' deleted`);
  }
}
