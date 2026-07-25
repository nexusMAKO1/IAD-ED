/**
 * health.module.ts — Health Module
 */

import { Module } from '@nestjs/common';
import { HealthController, SystemController } from './health.controller';

@Module({
  imports: [],
  controllers: [HealthController, SystemController],
  providers: [],
})
export class HealthModule {}
