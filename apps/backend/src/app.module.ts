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
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsInterceptor } from './common/metrics/metrics.interceptor';
import { MetricsController } from './common/metrics/metrics.controller';

@Module({
  imports: [
    // Global Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      envFilePath: ['.env'],
    }),

    // Monitoring
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
      defaultController: false,
    }),

    // Core Services
    PrismaModule,
    HealthModule,

    // Auth & User Domains
    AuthModule,
    UsersModule,
  ],
  controllers: [
    MetricsController,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
