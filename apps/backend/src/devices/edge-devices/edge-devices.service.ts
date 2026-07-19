import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MqttService } from '../../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../../mqtt/mqtt.topics';
import { DisplayStatus } from '@prisma/client';
import { HeartbeatMonitorService } from '../../health/heartbeat-monitor.service';

@Injectable()
export class EdgeDevicesService implements OnModuleInit {
  private readonly logger = new Logger(EdgeDevicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqtt: MqttService,
  ) {}

  onModuleInit() {
    this.logger.log('Subscribing to Edge Discovery and Heartbeat');
    
    const handler = async (_topic: string, data: any) => {
      // For system/health, we only process EDGE_CAMERA device types here
      if (_topic === MQTT_TOPICS.SYSTEM.HEALTH && data.deviceType !== 'EDGE_CAMERA') {
        return;
      }
      await this.handleDiscoveryHeartbeat(data);
    };

    this.mqtt.subscribeUnvalidated(MQTT_TOPICS.EDGE.DISCOVERY, handler);
    this.mqtt.subscribeUnvalidated(MQTT_TOPICS.EDGE.HEARTBEAT, handler);
    this.mqtt.subscribeUnvalidated(MQTT_TOPICS.SYSTEM.HEALTH, handler);
  }

  private async handleDiscoveryHeartbeat(data: any) {
    if (!data.deviceId) return;
    
    try {
      const existing = await this.prisma.edgeDevice.findUnique({
        where: { deviceId: data.deviceId },
      });

      const now = new Date();

      if (!existing) {
        // Create new UNPAIRED device
        this.logger.log(`[Discovery] New edge camera found: ${data.deviceId}`);
        await this.prisma.edgeDevice.create({
          data: {
            deviceId: data.deviceId,
            siteId: data.siteId || null,
            zoneId: data.zoneId || null,
            status: DisplayStatus.UNPAIRED,
            hostname: data.hostname,
            ip: data.ip,
            platform: data.platform,
            resolution: data.resolution,
            fps: data.fps,
            version: data.version,
            model: data.model,
            firmwareVersion: data.firmwareVersion,
            cpuUsage: data.cpuUsage,
            memoryUsage: data.memoryUsage,
            streamUrl: data.streamUrl,
            uptime: data.uptime || 0,
            mqttConnected: true,
            lastHeartbeat: now,
            lastSeen: now,
            connectedAt: now
          },
        });
      } else {
        const isCurrentlyUnpaired = existing.status === DisplayStatus.UNPAIRED;
        const newStatus = isCurrentlyUnpaired ? DisplayStatus.UNPAIRED : DisplayStatus.ONLINE;
        
        const newlyConnected = existing.status === DisplayStatus.OFFLINE || existing.status === DisplayStatus.UNKNOWN;

        // Update volatile fields
        await this.prisma.edgeDevice.update({
          where: { deviceId: data.deviceId },
          data: {
            status: newStatus,
            uptime: data.uptime || existing.uptime,
            ip: data.ip || existing.ip,
            fps: data.fps || existing.fps,
            cpuUsage: data.cpuUsage ?? existing.cpuUsage,
            memoryUsage: data.memoryUsage ?? existing.memoryUsage,
            version: data.version || existing.version,
            model: data.model || existing.model,
            streamUrl: data.streamUrl || existing.streamUrl,
            mqttConnected: true,
            lastHeartbeat: now,
            lastSeen: now,
            connectedAt: newlyConnected ? now : existing.connectedAt
          },
        });
      }
    } catch (err) {
      this.logger.error(`Error processing heartbeat for ${data.deviceId}`, err);
    }
  }

  async findAll() {
    try {
      const devices = await this.prisma.edgeDevice.findMany({
        include: { site: true },
        orderBy: { createdAt: 'desc' },
      });
      const now = new Date();
      return devices.map(d => ({
        ...d,
        status: HeartbeatMonitorService.computeStatus(d.lastHeartbeat, now, d.status) || d.status
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch edge devices: ${error}`);
      return [];
    }
  }

  async findUnpaired() {
    try {
      const devices = await this.prisma.edgeDevice.findMany({
        where: { status: DisplayStatus.UNPAIRED },
        orderBy: { lastSeen: 'desc' },
      });
      const now = new Date();
      return devices.map(d => ({
        ...d,
        status: HeartbeatMonitorService.computeStatus(d.lastHeartbeat, now, d.status) || d.status
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch unpaired edge devices: ${error}`);
      return [];
    }
  }

  async pair(id: string, siteId: string, zoneId: string) {
    const device = await this.prisma.edgeDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Edge device not found');

    const updated = await this.prisma.edgeDevice.update({
      where: { id },
      data: {
        siteId,
        zoneId,
        status: DisplayStatus.ONLINE,
      },
    });

    // Publish configuration to device
    this.mqtt.publish(MQTT_TOPICS.EDGE.CONFIG(device.deviceId), {
      siteId,
      zoneId,
    });

    return updated;
  }

  async unpair(id: string) {
    const device = await this.prisma.edgeDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Edge device not found');

    const updated = await this.prisma.edgeDevice.update({
      where: { id },
      data: {
        siteId: null,
        zoneId: null,
        status: DisplayStatus.UNPAIRED,
      },
    });

    // Publish null configuration to device so it unpairs
    this.mqtt.publish(MQTT_TOPICS.EDGE.CONFIG(device.deviceId), {
      siteId: null,
      zoneId: null,
    });

    return updated;
  }

  async remove(id: string) {
    return this.prisma.edgeDevice.delete({ where: { id } });
  }

  async findOne(id: string) {
    const device = await this.prisma.edgeDevice.findUnique({
      where: { id },
      include: { site: true },
    });
    if (!device) throw new NotFoundException('Edge device not found');
    const now = new Date();
    return {
      ...device,
      status: HeartbeatMonitorService.computeStatus(device.lastHeartbeat, now, device.status) || device.status
    };
  }

  async create(data: any) {
    return this.prisma.edgeDevice.create({ data });
  }

  async update(id: string, data: any) {
    return this.prisma.edgeDevice.update({
      where: { id },
      data,
    });
  }

  async updateSettings(id: string, settings: any) {
    const device = await this.prisma.edgeDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Edge device not found');

    // Publish settings via MQTT
    this.mqtt.publish(`smartvision/commands/camera`, {
      deviceId: device.deviceId,
      action: 'update_settings',
      payload: settings,
    });

    return { success: true };
  }

  async restart(id: string) {
    const device = await this.prisma.edgeDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Edge device not found');

    this.mqtt.publish(`smartvision/commands/restart`, {
      deviceId: device.deviceId,
      action: 'restart'
    });

    return { success: true, message: 'Restart command sent' };
  }

  async getMetrics(id: string) {
    const device = await this.prisma.edgeDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Edge device not found');

    return {
      cpuUsage: device.cpuUsage,
      memoryUsage: device.memoryUsage,
      fps: device.fps,
      uptime: device.uptime,
    };
  }

  async getHeartbeat(id: string) {
    const device = await this.prisma.edgeDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Edge device not found');

    return {
      lastSeen: device.lastSeen,
      lastHeartbeat: device.lastHeartbeat,
      mqttConnected: device.mqttConnected,
      status: device.status,
    };
  }
}
