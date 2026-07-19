import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt.topics';
import { DisplayStatus } from '@prisma/client';

// Thresholds in seconds
const OFFLINE_THRESHOLD_SECS = 60;
const WARNING_THRESHOLD_SECS = 30;

@Injectable()
export class HeartbeatMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HeartbeatMonitorService.name);
  private intervalTimer: NodeJS.Timeout | null = null;
  private lastExecution: Date | null = null;
  private devicesChecked = 0;
  private offlineDevices = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqtt: MqttService,
  ) {}

  onModuleInit() {
    this.intervalTimer = setInterval(() => this.scanHeartbeats(), 10_000);
    this.logger.log('Heartbeat monitor started (10s interval)');
  }

  onModuleDestroy() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
  }

  private async scanHeartbeats() {
    this.logger.log('=== Heartbeat monitor tick ===');
    try {
      const now = new Date();
      let checkedCount = 0;
      let offlineCount = 0;

      // ── Edge Cameras ─────────────────────────────────────────────
      const edgeDevices = await this.prisma.edgeDevice.findMany();
      for (const device of edgeDevices) {
        checkedCount++;
        // Use lastHeartbeat as primary; fall back to lastSeen
        const effectiveTs = device.lastHeartbeat ?? device.lastSeen;
        const elapsedSecs = effectiveTs
          ? Math.floor((now.getTime() - effectiveTs.getTime()) / 1000)
          : null;

        const newStatus = HeartbeatMonitorService.computeStatusWithFallback(
          device.lastHeartbeat,
          device.lastSeen,
          now,
          device.status,
        );

        this.logger.log(
          `[EdgeCamera] ${device.deviceId} | current=${device.status} | effectiveTs=${effectiveTs?.toISOString() ?? 'never'} | elapsed=${elapsedSecs ?? 'unknown'}s | computed=${newStatus ?? 'no-change'}`,
        );

        if (newStatus === DisplayStatus.OFFLINE) offlineCount++;

        if (newStatus && newStatus !== device.status) {
          const reason = newStatus === DisplayStatus.ONLINE
            ? 'Heartbeat received'
            : `Heartbeat timeout (${elapsedSecs ?? 'unknown'} seconds)`;

          this.logger.log(`EdgeDevice ${device.deviceId} status changed: ${device.status} -> ${newStatus} | Reason: ${reason}`);

          await this.prisma.edgeDevice.update({
            where: { id: device.id },
            data: {
              status: newStatus,
              disconnectedAt: newStatus === DisplayStatus.OFFLINE ? now : device.disconnectedAt,
            },
          });

          this.mqtt.publish(MQTT_TOPICS.FRONTEND.DEVICE_STATUS, {
            deviceId: device.deviceId,
            deviceType: 'EDGE_CAMERA',
            status: newStatus,
            lastHeartbeat: device.lastHeartbeat,
          });
        }
      }

      // ── Display Kiosks ───────────────────────────────────────────
      const displayDevices = await this.prisma.displayDevice.findMany();
      for (const device of displayDevices) {
        checkedCount++;
        const effectiveTs = device.lastHeartbeat ?? device.lastSeen;
        const elapsedSecs = effectiveTs
          ? Math.floor((now.getTime() - effectiveTs.getTime()) / 1000)
          : null;

        const newStatus = HeartbeatMonitorService.computeStatusWithFallback(
          device.lastHeartbeat,
          device.lastSeen,
          now,
          device.status,
        );

        this.logger.log(
          `[Display] ${device.deviceId} | current=${device.status} | effectiveTs=${effectiveTs?.toISOString() ?? 'never'} | elapsed=${elapsedSecs ?? 'unknown'}s | computed=${newStatus ?? 'no-change'}`,
        );

        if (newStatus === DisplayStatus.OFFLINE) offlineCount++;

        if (newStatus && newStatus !== device.status) {
          const reason = newStatus === DisplayStatus.ONLINE
            ? 'Heartbeat received'
            : `Heartbeat timeout (${elapsedSecs ?? 'unknown'} seconds)`;

          this.logger.log(`DisplayDevice ${device.deviceId} status changed: ${device.status} -> ${newStatus} | Reason: ${reason}`);

          await this.prisma.displayDevice.update({
            where: { id: device.id },
            data: {
              status: newStatus,
              disconnectedAt: newStatus === DisplayStatus.OFFLINE ? now : device.disconnectedAt,
            },
          });

          this.mqtt.publish(MQTT_TOPICS.FRONTEND.DEVICE_STATUS, {
            deviceId: device.deviceId,
            deviceType: 'DISPLAY',
            status: newStatus,
            lastHeartbeat: device.lastHeartbeat,
          });
        }
      }

      this.lastExecution = now;
      this.devicesChecked = checkedCount;
      this.offlineDevices = offlineCount;
    } catch (error) {
      this.logger.error('Error in heartbeat monitor', error);
    }
  }

  public getDiagnostics() {
    return {
      schedulerRunning: this.intervalTimer !== null,
      lastExecution: this.lastExecution?.toISOString() || null,
      devicesChecked: this.devicesChecked,
      offlineDevices: this.offlineDevices,
      nextExecution: this.lastExecution
        ? new Date(this.lastExecution.getTime() + 10_000).toISOString()
        : null,
      tickInterval: 10000,
    };
  }

  /**
   * Core status computation — uses lastHeartbeat as primary signal,
   * falls back to lastSeen when heartbeat is null so UNKNOWN devices
   * are correctly transitioned to OFFLINE instead of being skipped forever.
   */
  public static computeStatusWithFallback(
    lastHeartbeat: Date | null,
    lastSeen: Date | null,
    now: Date,
    currentStatus: DisplayStatus,
  ): DisplayStatus | null {
    // UNPAIRED devices are managed by the provisioning flow, not the heartbeat monitor
    if (currentStatus === DisplayStatus.UNPAIRED) return null;

    const effectiveTs = lastHeartbeat ?? lastSeen;

    if (!effectiveTs) {
      // Never seen — mark OFFLINE if not already
      return currentStatus !== DisplayStatus.OFFLINE ? DisplayStatus.OFFLINE : null;
    }

    const diffSecs = (now.getTime() - effectiveTs.getTime()) / 1000;

    if (diffSecs < WARNING_THRESHOLD_SECS) {
      return DisplayStatus.ONLINE;
    } else if (diffSecs < OFFLINE_THRESHOLD_SECS) {
      return DisplayStatus.WARNING;
    } else {
      return DisplayStatus.OFFLINE;
    }
  }

  /**
   * Legacy alias for the service read-path (findAll / findOne).
   * No lastSeen fallback — only considers lastHeartbeat.
   */
  public static computeStatus(
    lastHeartbeat: Date | null,
    now: Date,
    currentStatus: DisplayStatus,
  ): DisplayStatus | null {
    return HeartbeatMonitorService.computeStatusWithFallback(lastHeartbeat, null, now, currentStatus);
  }
}
