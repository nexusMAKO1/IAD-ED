/**
 * app.module.ts — Root Application Module
 * IAD & SmartQueue AI — Express Display SmartVision (T-012)
 *
 * Configures the global ConfigModule (with Joi validation),
 * Prisma database, health check module, and authentication/user domains.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Global Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      envFilePath: ['.env'],
    }),

    // Core Services
    PrismaModule,
    HealthModule,

    // Auth & User Domains
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
