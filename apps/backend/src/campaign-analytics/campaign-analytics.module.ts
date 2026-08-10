/**
 * campaign-analytics.module.ts
 * IAD Campaign Performance Analytics
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MqttModule } from '../mqtt/mqtt.module';

import { CampaignAnalyticsController } from './campaign-analytics.controller';
import { CampaignAnalyticsService } from './campaign-analytics.service';
import { CampaignImpressionService } from './campaign-impression.service';
import { CampaignViewTrackerService } from './campaign-view-tracker.service';
import { CampaignKpiService } from './campaign-kpi.service';
import { CampaignAggregationService } from './campaign-aggregation.service';
import { CampaignInsightsService } from './campaign-insights.service';

@Module({
  imports: [PrismaModule, MqttModule],
  controllers: [CampaignAnalyticsController],
  providers: [
    CampaignAnalyticsService,
    CampaignImpressionService,
    CampaignViewTrackerService,
    CampaignKpiService,
    CampaignAggregationService,
    CampaignInsightsService,
  ],
  exports: [CampaignAnalyticsService],
})
export class CampaignAnalyticsModule {}
