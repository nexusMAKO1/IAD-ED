/**
 * campaign-aggregation.service.ts — Cron job aggregator
 * IAD Campaign Performance Analytics
 *
 * Schedules (native setInterval/setTimeout — no extra packages required):
 *   - Every 5 minutes : update rolling CampaignMetric for all campaigns
 *   - Daily at 02:00  : compute CampaignDailyStatistic for yesterday
 *   - Daily at 02:15  : generate CampaignInsight for yesterday
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignKpiService } from './campaign-kpi.service';
import { CampaignInsightsService } from './campaign-insights.service';
import { PerformanceGrade } from './dto/campaign-analytics.dto';

@Injectable()
export class CampaignAggregationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignAggregationService.name);

  private rollingTimer: NodeJS.Timeout | null = null;
  private dailyTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly kpiService: CampaignKpiService,
    private readonly insightsService: CampaignInsightsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onModuleInit() {
    // Rolling metrics: every 5 minutes
    this.rollingTimer = setInterval(
      () => void this.aggregateRollingMetrics(),
      5 * 60 * 1000,
    );

    // Daily jobs: schedule via ms-until-target
    this.scheduleDailyAt(2, 0,  () => void this.computeDailyStats());
    this.scheduleDailyAt(2, 15, () => void this.generateInsights());

    this.logger.log('Aggregation scheduler started (5-min rolling + daily at 02:00/02:15)');
  }

  onModuleDestroy() {
    if (this.rollingTimer)  clearInterval(this.rollingTimer);
    if (this.dailyTimer)    clearTimeout(this.dailyTimer);
  }

  // ---------------------------------------------------------------------------
  // Every 5 minutes — rolling metrics
  // ---------------------------------------------------------------------------

  async aggregateRollingMetrics() {
    this.logger.debug('Running rolling metrics aggregation...');
    try {
      const campaigns = await this.prisma.campaign.findMany({ select: { id: true } });
      for (const { id } of campaigns) {
        await this.computeAndUpsertMetric(id);
      }
    } catch (err: any) {
      this.logger.error(`Rolling metrics aggregation failed: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Daily at 02:00 — daily statistics
  // ---------------------------------------------------------------------------

  async computeDailyStats() {
    this.logger.log('Running daily statistics computation...');
    const yesterday = this.getYesterday();
    try {
      const campaigns = await this.prisma.campaign.findMany({ select: { id: true } });
      for (const { id } of campaigns) {
        await this.computeDailyStatForCampaign(id, yesterday);
      }
      this.logger.log(`Daily stats completed for ${campaigns.length} campaigns.`);
    } catch (err: any) {
      this.logger.error(`Daily stats computation failed: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Daily at 02:15 — AI insights
  // ---------------------------------------------------------------------------

  async generateInsights() {
    this.logger.log('Running AI insight generation...');
    const yesterday = this.getYesterday();
    try {
      const stats = await this.prisma.campaignDailyStatistic.findMany({
        where:   { date: yesterday },
        include: { campaign: { select: { name: true } } },
      });

      for (const stat of stats) {
        const { text, recommendations } = this.insightsService.generateInsightText({
          campaignName:     stat.campaign.name,
          performanceScore: stat.performanceScore,
          engagementScore:  stat.engagementScore,
          grade:            stat.grade as PerformanceGrade,
          impressions:      stat.impressions,
          reach:            stat.reach,
          avgViewTimeSec:   stat.avgViewTimeSec,
          attentionRate:    stat.attentionRate,
          completionRate:   stat.completionRate,
          avgAudience:      stat.avgAudience,
          peakHour:         stat.peakHour,
          childCount:       stat.childCount,
          youngAdultCount:  stat.youngAdultCount,
          adultCount:       stat.adultCount,
          seniorCount:      stat.seniorCount,
        });

        await this.prisma.campaignInsight.upsert({
          where:  { campaignId_date: { campaignId: stat.campaignId, date: yesterday } },
          update: { text, recommendations, score: stat.performanceScore, grade: stat.grade },
          create: {
            campaignId:      stat.campaignId,
            date:            yesterday,
            text,
            recommendations,
            score:           stat.performanceScore,
            grade:           stat.grade,
          },
        });
      }

      this.logger.log(`Generated insights for ${stats.length} campaigns.`);
    } catch (err: any) {
      this.logger.error(`Insight generation failed: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Core computation (reusable)
  // ---------------------------------------------------------------------------

  async computeAndUpsertMetric(campaignId: string) {
    const impressionRows = await this.prisma.campaignImpression.findMany({
      where:  { campaignId },
      select: { id: true, plannedDurationSec: true, siteId: true },
    });

    const viewRows = await this.prisma.campaignViewEvent.findMany({
      where:  { impression: { campaignId } },
      select: { trackId: true, dwellSeconds: true, impressionId: true },
    });

    const totalImpressions = impressionRows.length;
    const uniqueTrackIds   = new Set(viewRows.map(v => `${v.impressionId}:${v.trackId}`));
    const totalReach       = uniqueTrackIds.size;

    const dwellTimes = viewRows.map(v => v.dwellSeconds).filter(d => d > 0);
    const avgViewTimeSec = dwellTimes.length > 0
      ? dwellTimes.reduce((s, d) => s + d, 0) / dwellTimes.length : 0;

    const plannedDuration  = impressionRows[0]?.plannedDurationSec ?? 15;
    const attentiveViewers = viewRows.filter(v => v.dwellSeconds >= 5).length;
    const attentionRate    = totalReach > 0 ? (attentiveViewers / totalReach) * 100 : 0;
    const completedViewers = viewRows.filter(v => v.dwellSeconds >= plannedDuration).length;
    const completionRate   = totalReach > 0 ? (completedViewers / totalReach) * 100 : 0;

    const siteIds = [...new Set(impressionRows.map(i => i.siteId))];
    const aeRows  = siteIds.length > 0
      ? await this.prisma.audienceEvent.findMany({
          where:  { siteId: { in: siteIds } },
          select: { peopleCount: true },
          take:   1000,
        })
      : [];
    const avgAudience = aeRows.length > 0
      ? aeRows.reduce((s, r) => s + r.peopleCount, 0) / aeRows.length : 0;

    const kpis = this.kpiService.computeAll({
      totalImpressions, totalReach, avgViewTimeSec,
      attentionRate, completionRate, avgAudience,
    });

    await this.prisma.campaignMetric.upsert({
      where:  { campaignId },
      update: {
        totalImpressions, totalReach, avgViewTimeSec,
        attentionRate, completionRate, avgAudience,
        engagementScore:  kpis.engagementScore,
        performanceScore: kpis.performanceScore,
        grade:            kpis.grade,
      },
      create: {
        campaignId,
        totalImpressions, totalReach, avgViewTimeSec,
        attentionRate, completionRate, avgAudience,
        engagementScore:  kpis.engagementScore,
        performanceScore: kpis.performanceScore,
        grade:            kpis.grade,
      },
    });
  }

  async computeDailyStatForCampaign(campaignId: string, date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const impressions = await this.prisma.campaignImpression.findMany({
      where:  { campaignId, startedAt: { gte: dayStart, lte: dayEnd } },
      select: { id: true, plannedDurationSec: true, siteId: true, startedAt: true },
    });

    const impressionIds    = impressions.map(i => i.id);
    const totalImpressions = impressionIds.length;

    const viewEvents = impressionIds.length > 0
      ? await this.prisma.campaignViewEvent.findMany({
          where:  { impressionId: { in: impressionIds } },
          select: { trackId: true, dwellSeconds: true, impressionId: true, ageGroup: true },
        })
      : [];

    const uniqueTrackIds = new Set(viewEvents.map(v => `${v.impressionId}:${v.trackId}`));
    const totalReach     = uniqueTrackIds.size;

    const dwellTimes        = viewEvents.map(v => v.dwellSeconds).filter(d => d > 0);
    const avgViewTimeSec    = dwellTimes.length > 0
      ? dwellTimes.reduce((s, d) => s + d, 0) / dwellTimes.length : 0;
    const medianViewTimeSec = this.kpiService.median(dwellTimes);
    const minViewTimeSec    = dwellTimes.length > 0 ? Math.min(...dwellTimes) : 0;
    const maxViewTimeSec    = dwellTimes.length > 0 ? Math.max(...dwellTimes) : 0;

    const plannedDuration  = impressions[0]?.plannedDurationSec ?? 15;
    const attentiveViewers = viewEvents.filter(v => v.dwellSeconds >= 5).length;
    const attentionRate    = totalReach > 0 ? (attentiveViewers / totalReach) * 100 : 0;
    const completedViewers = viewEvents.filter(v => v.dwellSeconds >= plannedDuration).length;
    const completionRate   = totalReach > 0 ? (completedViewers / totalReach) * 100 : 0;

    // Age breakdown
    let childCount = 0, youngAdultCount = 0, adultCount = 0, seniorCount = 0;
    for (const v of viewEvents) {
      const g = v.ageGroup;
      if (g === 'child' || g === 'teen')             childCount++;
      else if (g === 'young_adult')                  youngAdultCount++;
      else if (g === 'adult' || g === 'middle_aged') adultCount++;
      else if (g === 'senior')                       seniorCount++;
      else                                           adultCount++;
    }

    const siteIds = [...new Set(impressions.map(i => i.siteId))];
    const aeRows  = siteIds.length > 0
      ? await this.prisma.audienceEvent.findMany({
          where:  { siteId: { in: siteIds }, timestamp: { gte: dayStart, lte: dayEnd } },
          select: { peopleCount: true },
          take:   2000,
        })
      : [];
    const avgAudience = aeRows.length > 0
      ? aeRows.reduce((s, r) => s + r.peopleCount, 0) / aeRows.length : 0;

    // Peak hour
    const hourCounts: Record<number, number> = {};
    for (const imp of impressions) {
      const h = new Date(imp.startedAt).getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    }
    const peakHour = Object.keys(hourCounts).length > 0
      ? parseInt(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0])
      : null;

    const kpis = this.kpiService.computeAll({
      totalImpressions, totalReach, avgViewTimeSec,
      attentionRate, completionRate, avgAudience,
    });

    await this.prisma.campaignDailyStatistic.upsert({
      where:  { campaignId_date: { campaignId, date } },
      update: {
        impressions: totalImpressions, reach: totalReach,
        avgViewTimeSec, medianViewTimeSec, minViewTimeSec, maxViewTimeSec,
        attentionRate, completionRate, avgAudience,
        engagementScore: kpis.engagementScore, performanceScore: kpis.performanceScore,
        grade: kpis.grade, childCount, youngAdultCount, adultCount, seniorCount, peakHour,
      },
      create: {
        campaignId, date,
        impressions: totalImpressions, reach: totalReach,
        avgViewTimeSec, medianViewTimeSec, minViewTimeSec, maxViewTimeSec,
        attentionRate, completionRate, avgAudience,
        engagementScore: kpis.engagementScore, performanceScore: kpis.performanceScore,
        grade: kpis.grade, childCount, youngAdultCount, adultCount, seniorCount, peakHour,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async refreshMetric(campaignId: string) {
    await this.computeAndUpsertMetric(campaignId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getYesterday(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Schedule a callback to fire once at HH:MM daily (recurring via chained setTimeout) */
  private scheduleDailyAt(hour: number, minute: number, cb: () => void) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    const delay = next.getTime() - now.getTime();
    setTimeout(() => {
      cb();
      // Reschedule for every 24h thereafter
      setInterval(cb, 24 * 60 * 60 * 1000);
    }, delay);
  }
}
