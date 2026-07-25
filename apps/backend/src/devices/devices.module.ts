/**
 * devices.module.ts — Unified Devices Feature Module
 *
 * Provides:
 *   - DevicesController   REST API for all device types
 *   - DevicesService      CRUD + assignment logic
 *   - DeviceRegistryService  MQTT heartbeat handler (upserts Device table)
 *   - PresenceService     Heartbeat monitor (status transitions)
 */

import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DeviceRegistryService } from './device-registry.service';
import { PresenceService } from './presence.service';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [MqttModule],
  controllers: [DevicesController],
  providers: [DevicesService, DeviceRegistryService, PresenceService],
  exports: [DevicesService, DeviceRegistryService, PresenceService],
})
export class DevicesModule {}
