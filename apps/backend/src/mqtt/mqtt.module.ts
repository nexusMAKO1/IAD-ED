/**
 * mqtt.module.ts — MQTT Feature Module
 * Express Display SmartVision — T-021
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MqttConfigService } from './mqtt.config';
import { MqttService } from './mqtt.service';

@Module({
  imports: [ConfigModule],
  providers: [MqttConfigService, MqttService],
  exports: [MqttService],
})
export class MqttModule {}
