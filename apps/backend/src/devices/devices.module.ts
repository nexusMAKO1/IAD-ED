/**
 * devices.module.ts — Devices Feature Module
 * IAD & SmartQueue AI — Express Display SmartVision (T-032)
 *
 * Importe SitesModule pour utiliser SitesService (validation d'existence du site).
 */

import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { SitesModule } from '../sites/sites.module';

@Module({
  imports: [SitesModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
