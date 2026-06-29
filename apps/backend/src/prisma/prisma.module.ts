/**
 * prisma.module.ts — Prisma Module
 * IAD & SmartQueue AI — Express Display SmartVision (T-012)
 *
 * Global module so PrismaService can be injected anywhere without
 * importing PrismaModule explicitly in every feature module.
 */

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
