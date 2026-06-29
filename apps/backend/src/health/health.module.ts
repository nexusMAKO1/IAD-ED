/**
 * health.module.ts — Health Module
 * IAD & SmartQueue AI — Express Display SmartVision (T-012)
 */

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
