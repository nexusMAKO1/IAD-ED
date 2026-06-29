/**
 * prisma.service.ts — Prisma Database Service
 * IAD & SmartQueue AI — Express Display SmartVision (T-012)
 *
 * Singleton service wrapping PrismaClient with:
 * - Automatic connection on module init
 * - Graceful shutdown hooks integrated with NestJS lifecycle
 * - Logging of connection events
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to PostgreSQL database via Prisma...');
    await this.$connect();
    this.logger.log('Prisma connected successfully.');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting Prisma client...');
    await this.$disconnect();
    this.logger.log('Prisma disconnected.');
  }
}
