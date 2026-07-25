/**
 * presence.service.ts — Unified Presence / Heartbeat Monitor
 *
 * Single service that scans ALL devices in the Device table every 10 seconds
 * and transitions statuses:
 *   < 30s  → ONLINE
 *   30–60s → WARNING
 *   > 60s  → OFFLINE
 *
 * Replaces HeartbeatMonitorService which operated on separate
 * EdgeDevice and DisplayDevice tables.
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt.topics';
import { DeviceStatus } from '@prisma/client';

const ONLINE_THRESHOLD_SECS = 30;
const WARNING_THRESHOLD_SECS = 60;

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRun: Date | null = null;
  private checkedCount = 0;
  private offlineCount = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqtt: MqttService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.scan(), 10_000);
    this.logger.log('PresenceService started (10 s scan interval)');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Compute status purely from lastHeartbeat timestamp. */
  static computeStatus(
    lastHeartbeat: Date | null,
    lastSeen: Date | null,
    now: Date,
    current: DeviceStatus,
  ): DeviceStatus | null {
    // UNPAIRED devices are never transitioned by the presence monitor
    if (current === DeviceStatus.UNPAIRED) return null;

    const ts = lastHeartbeat ?? lastSeen;

    if (!ts) {
      return current !== DeviceStatus.OFFLINE ? DeviceStatus.OFFLINE : null;
    }

    const secs = (now.getTime() - ts.getTime()) / 1000;

    if (secs < ONLINE_THRESHOLD_SECS) return DeviceStatus.ONLINE;
    if (secs < WARNING_THRESHOLD_SECS) return DeviceStatus.WARNING;
    return DeviceStatus.OFFLINE;
  }

  private async scan() {
    try {
      const now = new Date();
      let checked = 0;
      let offline = 0;

      const devices = await this.prisma.device.findMany();

      for (const device of devices) {
        checked++;

        const newStatus = PresenceService.computeStatus(
          device.lastHeartbeat,
          device.lastSeen,
          now,
          device.status,
        );

        const elapsed = device.lastHeartbeat
          ? Math.floor((now.getTime() - device.lastHeartbeat.getTime()) / 1000)
          : null;

        this.logger.debug(
          `[Presence] ${device.deviceId} | ${device.status} → ${newStatus ?? 'no-change'} | ${elapsed ?? 'never'}s`,
        );

        if (newStatus === DeviceStatus.OFFLINE) offline++;

        if (newStatus && newStatus !== device.status) {
          await this.prisma.device.update({
            where: { id: device.id },
            data: {
              status: newStatus,
              disconnectedAt:
                newStatus === DeviceStatus.OFFLINE
                  ? now
                  : device.disconnectedAt,
            },
          });

          this.logger.log(
            `[Presence] ${device.deviceId} (${device.type}) ${device.status} → ${newStatus}`,
          );

          // Broadcast status change to frontend
          this.mqtt.publish(MQTT_TOPICS.FRONTEND.DEVICE_STATUS, {
            id: device.id,
            deviceId: device.deviceId,
            type: device.type,
            status: newStatus,
            lastHeartbeat: device.lastHeartbeat,
            siteId: device.siteId,
          });
        }
      }

      this.lastRun = now;
      this.checkedCount = checked;
      this.offlineCount = offline;
    } catch (err: any) {
      this.logger.error('[Presence] Scan error', err?.message);
    }
  }

  getDiagnostics() {
    return {
      schedulerRunning: this.timer !== null,
      lastExecution: this.lastRun?.toISOString() ?? null,
      devicesChecked: this.checkedCount,
      offlineDevices: this.offlineCount,
      nextExecution: this.lastRun
        ? new Date(this.lastRun.getTime() + 10_000).toISOString()
        : null,
      tickInterval: 10_000,
    };
  }
}
