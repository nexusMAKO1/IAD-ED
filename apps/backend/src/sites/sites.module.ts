/**
 * sites.module.ts — Sites Feature Module
 * IAD & SmartQueue AI — Express Display SmartVision (T-032)
 */

import { Module } from '@nestjs/common';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';

@Module({
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
