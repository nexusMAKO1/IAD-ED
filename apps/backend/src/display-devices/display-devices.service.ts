import { Injectable, Logger, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt.topics';
import { DisplayStatus } from '@prisma/client';
import { HeartbeatMonitorService } from '../health/heartbeat-monitor.service';

@Injectable()
export class DisplayDevicesService implements OnModuleInit {
  private readonly logger = new Logger(DisplayDevicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
  ) {}

  onModuleInit() {
    this.logger.log('Subscribing to Display Discovery and Heartbeat');
    
    const handler = async (_topic: string, data: any) => {
      // For system/health, we only process DISPLAY device types here
      if (_topic === MQTT_TOPICS.SYSTEM.HEALTH && data.deviceType !== 'DISPLAY') {
        return;
      }
      await this.handleDiscoveryHeartbeat(data);
    };

    this.mqttService.subscribeUnvalidated(MQTT_TOPICS.DISPLAY.DISCOVERY, handler);
    this.mqttService.subscribeUnvalidated(MQTT_TOPICS.DISPLAY.HEARTBEAT, handler);
    this.mqttService.subscribeUnvalidated(MQTT_TOPICS.SYSTEM.HEALTH, handler);
  }

  private async handleDiscoveryHeartbeat(data: any) {
    if (!data.deviceId) return;
    
    try {
      const existing = await this.prisma.displayDevice.findUnique({
        where: { deviceId: data.deviceId },
      });

      const now = new Date();

      if (!existing) {
        // Create new UNPAIRED device
        this.logger.log(`[Discovery] New display found: ${data.deviceId}`);
        await this.prisma.displayDevice.create({
          data: {
            deviceId: data.deviceId,
            siteId: data.siteId || null,
            screenId: data.screenId || null,
            status: DisplayStatus.UNPAIRED,
            hostname: data.hostname,
            ip: data.ip,
            platform: data.platform,
            resolution: data.resolution,
            version: data.version,
            uptime: data.uptime || 0,
            lastSeen: now,
            lastHeartbeat: now,
            mqttConnected: true,
            connectedAt: now
          },
        });
      } else {
        const isCurrentlyUnpaired = existing.status === DisplayStatus.UNPAIRED;
        const newStatus = isCurrentlyUnpaired ? DisplayStatus.UNPAIRED : DisplayStatus.ONLINE;
        
        const newlyConnected = existing.status === DisplayStatus.OFFLINE || existing.status === DisplayStatus.UNKNOWN;

        // Update volatile fields
        await this.prisma.displayDevice.update({
          where: { deviceId: data.deviceId },
          data: {
            status: newStatus,
            uptime: data.uptime || existing.uptime,
            ip: data.ip || existing.ip,
            lastSeen: now,
            lastHeartbeat: now,
            mqttConnected: true,
            connectedAt: newlyConnected ? now : existing.connectedAt
          },
        });
      }
    } catch (err) {
      this.logger.error(`Error processing heartbeat for ${data.deviceId}`, err);
    }
  }

  async findAll(query?: { status?: DisplayStatus; siteId?: string }) {
    const where: any = {};
    if (query?.status) where.status = query.status;
    if (query?.siteId) where.siteId = query.siteId;

    const devices = await this.prisma.displayDevice.findMany({
      where,
      include: { site: true, screen: true },
      orderBy: { lastSeen: 'desc' },
    });

    const now = new Date();
    return devices.map(d => ({
      ...d,
      status: HeartbeatMonitorService.computeStatus(d.lastHeartbeat, now, d.status) || d.status
    }));
  }

  async getUnpaired() {
    return this.findAll({ status: DisplayStatus.UNPAIRED });
  }

  async pair(id: string, siteId: string, screenId?: string) {
    const display = await this.prisma.displayDevice.findUnique({ where: { id } });
    if (!display) throw new NotFoundException('Display not found');

    const updated = await this.prisma.displayDevice.update({
      where: { id },
      data: {
        siteId,
        screenId: screenId || null,
        status: DisplayStatus.ONLINE,
      },
    });

    this.logger.log(`[Provisioning] Paired display ${display.deviceId} to site ${siteId}`);

    // Publish configuration to display
    const topic = MQTT_TOPICS.DISPLAY.CONFIG(display.deviceId);
    this.mqttService.publish(topic, {
      siteId,
      screenId: screenId || null,
    });

    return updated;
  }

  async unpair(id: string) {
    const display = await this.prisma.displayDevice.findUnique({ where: { id } });
    if (!display) throw new NotFoundException('Display not found');

    const updated = await this.prisma.displayDevice.update({
      where: { id },
      data: {
        siteId: null,
        screenId: null,
        status: DisplayStatus.UNPAIRED,
      },
    });

    this.logger.log(`[Provisioning] Unpaired display ${display.deviceId}`);

    // Publish configuration to display
    const topic = MQTT_TOPICS.DISPLAY.CONFIG(display.deviceId);
    this.mqttService.publish(topic, {
      siteId: null,
      screenId: null,
    });

    return updated;
  }

  async remove(id: string) {
    try {
      return await this.prisma.displayDevice.delete({ where: { id } });
    } catch (e) {
      throw new NotFoundException('Display not found');
    }
  }
}
