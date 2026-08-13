/**
 * devices.service.ts — Unified Device Business Logic
 *
 * Single source of truth for all device types (EDGE_CAMERA, DISPLAY, etc).
 * Wraps DeviceRegistryService for assignment and provides CRUD operations.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DeviceType, DeviceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt.topics';
import { PresenceService } from './presence.service';
import { DeviceRegistryService } from './device-registry.service';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqtt: MqttService,
    private readonly registry: DeviceRegistryService,
  ) {}

  // ─── Read ──────────────────────────────────────────────────────────────────

  async findAll(filters?: {
    siteId?: string;
    type?: DeviceType;
    status?: DeviceStatus;
    unassigned?: boolean;
  }) {
    const where: any = {};
    if (filters?.siteId) where.siteId = filters.siteId;
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.unassigned) where.siteId = null;

    const now = new Date();
    const devices = await this.prisma.device.findMany({
      where,
      include: {
        site: { select: { id: true, name: true } },
        cameraMetadata: true,
        displayMetadata: true,
      },
      orderBy: { lastHeartbeat: 'desc' },
    });

    // Apply real-time status correction (same as PresenceService logic)
    return devices.map((d) => {
      const computed = PresenceService.computeStatus(
        d.lastHeartbeat,
        d.lastSeen,
        now,
        d.status,
      );
      return { ...d, status: computed ?? d.status };
    });
  }

  async findOne(id: string) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        site: true,
        cameraMetadata: true,
        displayMetadata: true,
      },
    });
    if (!device) throw new NotFoundException(`Appareil '${id}' introuvable`);

    const now = new Date();
    const computed = PresenceService.computeStatus(
      device.lastHeartbeat,
      device.lastSeen,
      now,
      device.status,
    );
    return { ...device, status: computed ?? device.status };
  }

  // ─── Assign / Unpair ───────────────────────────────────────────────────────

  async assignSite(
    id: string,
    siteId: string,
    extra: Record<string, any> = {},
  ) {
    // Validate site exists
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException(`Site '${siteId}' introuvable`);

    // Update optional zone for cameras
    if (extra.zoneId) {
      const device = await this.prisma.device.findUnique({ where: { id } });
      if (device) {
        await this.prisma.cameraMetadata.upsert({
          where: { deviceId: device.id },
          create: { deviceId: device.id, zoneId: extra.zoneId },
          update: { zoneId: extra.zoneId },
        });
      }
    }

    return this.registry.assignToSite(id, siteId, extra);
  }

  async unpair(id: string) {
    return this.registry.assignToSite(id, null);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: any) {
    const existing = await this.findOne(id);

    const updated = await this.prisma.device.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        siteId: dto.siteId !== undefined ? dto.siteId : undefined,
        status: dto.status ?? undefined,
        ip: dto.ip ?? undefined,
      },
      include: {
        site: true,
        cameraMetadata: true,
        displayMetadata: true,
      },
    });

    this.logger.log(`Device updated: ${updated.name} (${id})`);

    // Broadcast rename/update to all frontend subscribers
    this.mqtt.publish(MQTT_TOPICS.FRONTEND.DEVICE_UPDATED, {
      event: 'device.updated',
      id: updated.id,
      deviceId: updated.deviceId,
      name: updated.name,
      siteId: updated.siteId,
      status: updated.status,
      type: updated.type,
    });

    return updated;
  }

  // ─── Camera-specific actions ───────────────────────────────────────────────

  async restartDevice(id: string) {
    const device = await this.findOne(id);
    this.mqtt.publish(MQTT_TOPICS.COMMANDS.RESTART, {
      deviceId: device.deviceId,
      action: 'restart',
    });
    return { success: true, message: 'Commande de redémarrage envoyée' };
  }

  async updateCameraSettings(id: string, settings: any) {
    const device = await this.findOne(id);
    this.mqtt.publish(MQTT_TOPICS.COMMANDS.CAMERA, {
      deviceId: device.deviceId,
      action: 'update_settings',
      payload: settings,
    });

    // Persist detectionEnabled / ageEstimatorEnabled if provided
    if (
      settings.detectionEnabled !== undefined ||
      settings.ageEstimatorEnabled !== undefined
    ) {
      await this.prisma.cameraMetadata.upsert({
        where: { deviceId: device.id },
        create: {
          deviceId: device.id,
          detectionEnabled: settings.detectionEnabled ?? true,
          ageEstimatorEnabled: settings.ageEstimatorEnabled ?? true,
        },
        update: {
          detectionEnabled: settings.detectionEnabled ?? undefined,
          ageEstimatorEnabled: settings.ageEstimatorEnabled ?? undefined,
        },
      });
    }

    return { success: true };
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async remove(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException(`Appareil '${id}' introuvable`);

    // Cascade deletes camera/display metadata via FK
    await this.prisma.device.delete({ where: { id } });

    this.logger.log(`Device deleted: ${device.deviceId} (${device.type})`);

    // Broadcast deletion to all frontend subscribers
    this.mqtt.publish(MQTT_TOPICS.FRONTEND.DEVICE_UPDATED, {
      event: 'device.deleted',
      id: device.id,
      deviceId: device.deviceId,
      type: device.type,
    });
  }
}
