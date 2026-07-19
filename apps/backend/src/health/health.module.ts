/**
 * health.module.ts — Health Module
 * IAD & SmartQueue AI — Express Display SmartVision (T-012)
 */

import { Module } from '@nestjs/common';
import { HealthController, SystemController } from './health.controller';
import { HeartbeatMonitorService } from './heartbeat-monitor.service';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [MqttModule],
  controllers: [HealthController, SystemController],
  providers: [HeartbeatMonitorService],
})
export class HealthModule {}
