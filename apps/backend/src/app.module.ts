/**
 * app.module.ts — Root Application Module
 * IAD & SmartQueue AI — Express Display SmartVision
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
import { MqttModule } from './mqtt/mqtt.module';
import { SitesModule } from './sites/sites.module';
import { DevicesModule } from './devices/devices.module';
import { AudienceEventsModule } from './audience-events/audience-events.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { SettingsModule } from './settings/settings.module';
import { CampaignAnalyticsModule } from './campaign-analytics/campaign-analytics.module';

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
      controller: MetricsController,
    }),

    // Core Services
    PrismaModule,
    HealthModule,

    // MQTT Communication Layer (T-021)
    MqttModule,

    // Auth & User Domains
    AuthModule,
    UsersModule,

    // Unified Fleet Management — Single Source of Truth
    SitesModule,
    DevicesModule,

    // Audience Analytics Integration (T-033)
    AudienceEventsModule,

    // Campaign Management & Decision Engine
    CampaignsModule,

    // Campaign Performance Analytics
    CampaignAnalyticsModule,

    // Application Settings (persisted)
    SettingsModule,

    // Custom IAD Metrics
    MetricsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
