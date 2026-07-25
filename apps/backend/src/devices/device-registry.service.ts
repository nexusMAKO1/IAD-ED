/**
 * device-registry.service.ts — Unified Device Registry
 *
 * Single MQTT handler for ALL device heartbeats (Cameras + Displays).
 * Upserts the Device table on every heartbeat, creating CameraMetadata
 * or DisplayMetadata as needed.
 *
 * This service replaces:
 *   - EdgeDevicesService.handleDiscoveryHeartbeat()
 *   - DisplayDevicesService.handleDiscoveryHeartbeat()
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt.topics';
import { DeviceType, DeviceStatus } from '@prisma/client';

@Injectable()
export class DeviceRegistryService implements OnModuleInit {
  private readonly logger = new Logger(DeviceRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqtt: MqttService,
  ) {}

  onModuleInit() {
    this.logger.log('DeviceRegistry: subscribing to all device heartbeats');

    // Subscribe to Edge Camera topics
    this.mqtt.subscribeUnvalidated(MQTT_TOPICS.EDGE.DISCOVERY, (_t, data) =>
      this.handleHeartbeat(data, DeviceType.EDGE_CAMERA),
    );
    this.mqtt.subscribeUnvalidated(MQTT_TOPICS.EDGE.HEARTBEAT, (_t, data) =>
      this.handleHeartbeat(data, DeviceType.EDGE_CAMERA),
    );

    // Subscribe to Display Kiosk topics
    this.mqtt.subscribeUnvalidated(MQTT_TOPICS.DISPLAY.DISCOVERY, (_t, data) =>
      this.handleHeartbeat(data, DeviceType.DISPLAY),
    );
    this.mqtt.subscribeUnvalidated(MQTT_TOPICS.DISPLAY.HEARTBEAT, (_t, data) =>
      this.handleHeartbeat(data, DeviceType.DISPLAY),
    );

    // Unified system/health topic — route by deviceType field
    this.mqtt.subscribeUnvalidated(MQTT_TOPICS.SYSTEM.HEALTH, (_t, data) => {
      const type =
        data.deviceType === 'EDGE_CAMERA'
          ? DeviceType.EDGE_CAMERA
          : data.deviceType === 'DISPLAY'
            ? DeviceType.DISPLAY
            : null;
      if (type) this.handleHeartbeat(data, type);
    });
  }

  async handleHeartbeat(data: any, deviceType: DeviceType) {
    if (!data?.deviceId) return;

    try {
      const now = new Date();
      const existing = await this.prisma.device.findUnique({
        where: { deviceId: data.deviceId },
      });

      if (!existing) {
        // ── First contact: create a new UNPAIRED device ──────────────
        this.logger.log(
          `[Registry] New ${deviceType} discovered: ${data.deviceId}`,
        );

        const device = await this.prisma.device.create({
          data: {
            deviceId: data.deviceId,
            name: data.friendlyName || data.hostname || data.deviceId,
            type: deviceType,
            siteId: data.siteId || null,
            status: DeviceStatus.UNPAIRED,
            hostname: data.hostname,
            ip: data.ip,
            platform: data.platform,
            version: data.version,
            firmwareVersion: data.firmwareVersion,
            lastHeartbeat: now,
            lastSeen: now,
            mqttConnected: true,
            connectedAt: now,
            uptime: data.uptime || 0,
          },
        });

        // Create type-specific metadata
        if (deviceType === DeviceType.EDGE_CAMERA) {
          await this.prisma.cameraMetadata.create({
            data: {
              deviceId: device.id,
              fps: data.fps,
              resolution: data.resolution,
              streamUrl: data.streamUrl,
              model: data.model,
              cpuUsage: data.cpuUsage,
              memoryUsage: data.memoryUsage,
              zoneId: data.zoneId,
              macAddress: data.macAddress,
            },
          });
        } else if (deviceType === DeviceType.DISPLAY) {
          await this.prisma.displayMetadata.create({
            data: {
              deviceId: device.id,
              screenResolution: data.resolution,
              kioskVersion: data.version,
            },
          });
        }

        this.emitDeviceEvent('device.created', device.id, deviceType, data.deviceId);
      } else {
        // ── Subsequent heartbeat: update volatile fields ──────────────
        const isUnpaired = existing.status === DeviceStatus.UNPAIRED;
        const newStatus = isUnpaired ? DeviceStatus.UNPAIRED : DeviceStatus.ONLINE;
        const newlyConnected =
          existing.status === DeviceStatus.OFFLINE ||
          existing.status === DeviceStatus.UNKNOWN;

        await this.prisma.device.update({
          where: { deviceId: data.deviceId },
          data: {
            status: newStatus,
            ip: data.ip || existing.ip,
            hostname: data.hostname || existing.hostname,
            version: data.version || existing.version,
            uptime: data.uptime ?? existing.uptime,
            lastHeartbeat: now,
            lastSeen: now,
            mqttConnected: true,
            connectedAt: newlyConnected ? now : existing.connectedAt,
          },
        });

        // Update type-specific volatile metadata
        if (deviceType === DeviceType.EDGE_CAMERA) {
          await this.prisma.cameraMetadata.upsert({
            where: { deviceId: existing.id },
            create: {
              deviceId: existing.id,
              fps: data.fps,
              resolution: data.resolution,
              streamUrl: data.streamUrl,
              model: data.model,
              cpuUsage: data.cpuUsage,
              memoryUsage: data.memoryUsage,
              zoneId: data.zoneId,
            },
            update: {
              fps: data.fps ?? undefined,
              cpuUsage: data.cpuUsage ?? undefined,
              memoryUsage: data.memoryUsage ?? undefined,
              streamUrl: data.streamUrl || undefined,
            },
          });
        } else if (deviceType === DeviceType.DISPLAY) {
          await this.prisma.displayMetadata.upsert({
            where: { deviceId: existing.id },
            create: {
              deviceId: existing.id,
              screenResolution: data.resolution,
              kioskVersion: data.version,
            },
            update: {
              kioskVersion: data.version || undefined,
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(
        `[Registry] Error processing heartbeat for ${data.deviceId}: ${err.message}`,
        err.stack,
      );
    }
  }

  private emitDeviceEvent(
    event: string,
    id: string,
    type: DeviceType,
    deviceId: string,
  ) {
    this.mqtt.publish(MQTT_TOPICS.FRONTEND.DEVICE_UPDATED, {
      event,
      id,
      type,
      deviceId,
    });
  }

  /**
   * Assign a device to a site. Called by DevicesController.
   * Publishes the new config to the physical device via MQTT.
   */
  async assignToSite(
    devicePrismaId: string,
    siteId: string | null,
    extraData: Record<string, any> = {},
  ) {
    const device = await this.prisma.device.findUnique({
      where: { id: devicePrismaId },
      include: { cameraMetadata: true },
    });
    if (!device) throw new Error('Device not found');

    const newStatus =
      siteId === null ? DeviceStatus.UNPAIRED : DeviceStatus.ONLINE;

    const updated = await this.prisma.device.update({
      where: { id: devicePrismaId },
      data: { siteId, status: newStatus },
      include: { site: true, cameraMetadata: true, displayMetadata: true },
    });

    // Push assignment config back to device via MQTT
    if (device.type === DeviceType.EDGE_CAMERA) {
      this.mqtt.publish(MQTT_TOPICS.EDGE.CONFIG(device.deviceId), {
        siteId,
        zoneId: device.cameraMetadata?.zoneId ?? extraData.zoneId ?? null,
      });
    } else if (device.type === DeviceType.DISPLAY) {
      this.mqtt.publish(MQTT_TOPICS.DISPLAY.CONFIG(device.deviceId), {
        siteId,
        screenId: extraData.screenId ?? null,
      });
    }

    // Broadcast to frontend
    this.mqtt.publish(MQTT_TOPICS.FRONTEND.DEVICE_UPDATED, {
      event: siteId ? 'device.assigned' : 'device.unassigned',
      id: updated.id,
      deviceId: updated.deviceId,
      siteId: updated.siteId,
      status: updated.status,
    });

    return updated;
  }
}
