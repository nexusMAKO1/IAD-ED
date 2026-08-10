/**
 * campaign-analytics.service.ts — Main orchestrator for REST queries
 * IAD Campaign Performance Analytics
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignAggregationService } from './campaign-aggregation.service';
import { CampaignKpiService } from './campaign-kpi.service';
import { CampaignInsightsService } from './campaign-insights.service';
import {
  CampaignMetricDto,
  CampaignDetailResponseDto,
  CampaignOverviewDto,
  CampaignComparisonItemDto,
  GRADE_LABELS,
  PerformanceGrade,
} from './dto/campaign-analytics.dto';

@Injectable()
export class CampaignAnalyticsService {
  private readonly logger = new Logger(CampaignAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregation: CampaignAggregationService,
    private readonly kpiService: CampaignKpiService,
    private readonly insightsService: CampaignInsightsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Overview — all campaigns summary
  // ---------------------------------------------------------------------------

  async getOverview(): Promise<CampaignOverviewDto> {
    const campaigns = await this.prisma.campaign.findMany({
      select: { id: true, name: true, status: true, priority: true, active: true },
    });

    const metrics = await this.prisma.campaignMetric.findMany({
      include: { campaign: { select: { name: true, status: true, priority: true } } },
      orderBy: { performanceScore: 'desc' },
    });

    // Ensure all campaigns have a metric row (trigger lazy compute for new campaigns)
    const campaignsWithoutMetric = campaigns.filter(
      c => !metrics.find(m => m.campaignId === c.id),
    );
    for (const c of campaignsWithoutMetric) {
      await this.aggregation.refreshMetric(c.id);
    }

    // Re-fetch if we computed any
    const allMetrics = campaignsWithoutMetric.length > 0
      ? await this.prisma.campaignMetric.findMany({
          include: { campaign: { select: { name: true, status: true, priority: true } } },
          orderBy: { performanceScore: 'desc' },
        })
      : metrics;

    const leaderboard = allMetrics.map((m, i) =>
      this.toMetricDto(m, m.campaign.name, m.campaign.status, m.campaign.priority, i + 1),
    );

    const activeCampaigns = campaigns.filter(c => c.active).length;
    const totalImpressions = allMetrics.reduce((s, m) => s + m.totalImpressions, 0);
    const totalReach       = allMetrics.reduce((s, m) => s + m.totalReach, 0);
    const avgViewTimeSec   = allMetrics.length > 0
      ? allMetrics.reduce((s, m) => s + m.avgViewTimeSec, 0) / allMetrics.length : 0;
    const avgAttentionRate = allMetrics.length > 0
      ? allMetrics.reduce((s, m) => s + m.attentionRate, 0) / allMetrics.length : 0;
    const avgPerformanceScore = allMetrics.length > 0
      ? allMetrics.reduce((s, m) => s + m.performanceScore, 0) / allMetrics.length : 0;

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns,
      totalImpressions,
      totalReach,
      avgViewTimeSec: Math.round(avgViewTimeSec * 10) / 10,
      avgAttentionRate: Math.round(avgAttentionRate * 10) / 10,
      avgPerformanceScore: Math.round(avgPerformanceScore * 10) / 10,
      bestCampaign:  leaderboard[0],
      worstCampaign: leaderboard[leaderboard.length - 1],
      leaderboard,
    };
  }

  // ---------------------------------------------------------------------------
  // Leaderboard
  // ---------------------------------------------------------------------------

  async getLeaderboard() {
    const metrics = await this.prisma.campaignMetric.findMany({
      include: { campaign: { select: { name: true, status: true, priority: true } } },
      orderBy: { performanceScore: 'desc' },
    });

    return metrics.map((m, i) =>
      this.toMetricDto(m, m.campaign.name, m.campaign.status, m.campaign.priority, i + 1),
    );
  }

  // ---------------------------------------------------------------------------
  // Per-campaign detail
  // ---------------------------------------------------------------------------

  async getCampaignPerformance(campaignId: string): Promise<CampaignMetricDto> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

    let metric = await this.prisma.campaignMetric.findUnique({
      where: { campaignId },
    });

    if (!metric) {
      await this.aggregation.refreshMetric(campaignId);
      metric = await this.prisma.campaignMetric.findUnique({ where: { campaignId } });
    }
    if (!metric) {
      return this.emptyMetricDto(campaignId, campaign.name, campaign.status, campaign.priority);
    }

    return this.toMetricDto(metric, campaign.name, campaign.status, campaign.priority);
  }

  async getCampaignDetail(campaignId: string): Promise<CampaignDetailResponseDto> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

    const [metrics, timeline, viewEvents, latestInsight] = await Promise.all([
      this.getCampaignPerformance(campaignId),
      this.getTimeline(campaignId),
      this.prisma.campaignViewEvent.findMany({
        where: { impression: { campaignId } },
        select: { dwellSeconds: true, ageGroup: true, trackId: true, impressionId: true },
      }),
      this.prisma.campaignInsight.findFirst({
        where:   { campaignId },
        orderBy: { date: 'desc' },
      }),
    ]);

    // View time stats
    const dwellTimes = viewEvents.map(v => v.dwellSeconds).filter(d => d > 0);
    const viewTimeStats = {
      avg:    Math.round((dwellTimes.length ? dwellTimes.reduce((s, d) => s + d, 0) / dwellTimes.length : 0) * 10) / 10,
      median: Math.round(this.kpiService.median(dwellTimes) * 10) / 10,
      min:    dwellTimes.length ? Math.min(...dwellTimes) : 0,
      max:    dwellTimes.length ? Math.max(...dwellTimes) : 0,
    };

    // Age breakdown
    let child = 0, youngAdult = 0, adult = 0, senior = 0;
    for (const v of viewEvents) {
      const g = v.ageGroup;
      if (g === 'child' || g === 'teen')            child++;
      else if (g === 'young_adult')                 youngAdult++;
      else if (g === 'adult' || g === 'middle_aged') adult++;
      else if (g === 'senior')                      senior++;
      else                                          adult++;
    }

    // Peak hours
    const peakHoursMap: Record<number, number> = {};
    for (const stat of timeline) {
      // Use existing daily stat peakHour if available (we'll compute from impressions directly)
    }

    const impressionHours = await this.prisma.campaignImpression.findMany({
      where:  { campaignId },
      select: { startedAt: true },
    });
    for (const imp of impressionHours) {
      const h = new Date(imp.startedAt).getHours();
      peakHoursMap[h] = (peakHoursMap[h] ?? 0) + 1;
    }
    const peakHours = Object.entries(peakHoursMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        label: `${hour}h00`,
        impressions: count,
      }));

    return {
      campaign,
      metrics,
      viewTimeStats,
      audienceBreakdown: { child, youngAdult, adult, senior },
      peakHours,
      timeline,
      latestInsight: latestInsight ? {
        campaignId:      latestInsight.campaignId,
        date:            latestInsight.date.toISOString(),
        text:            latestInsight.text,
        recommendations: latestInsight.recommendations as string[],
        score:           latestInsight.score,
        grade:           latestInsight.grade as PerformanceGrade,
      } : undefined,
    };
  }

  async getTimeline(campaignId: string) {
    const stats = await this.prisma.campaignDailyStatistic.findMany({
      where:   { campaignId },
      orderBy: { date: 'asc' },
      take:    30,
    });

    return stats.map(s => ({
      date:             s.date.toISOString().split('T')[0],
      impressions:      s.impressions,
      reach:            s.reach,
      avgViewTimeSec:   s.avgViewTimeSec,
      attentionRate:    s.attentionRate,
      completionRate:   s.completionRate,
      avgAudience:      s.avgAudience,
      engagementScore:  s.engagementScore,
      performanceScore: s.performanceScore,
      grade:            s.grade as PerformanceGrade,
    }));
  }

  async getAudienceBreakdown(campaignId: string) {
    const viewEvents = await this.prisma.campaignViewEvent.findMany({
      where: { impression: { campaignId } },
      select: { ageGroup: true, trackId: true, impressionId: true },
    });

    const uniqueTrackers = new Set(viewEvents.map(v => `${v.impressionId}:${v.trackId}`));
    const breakdown: Record<string, number> = {};

    for (const v of viewEvents) {
      const key = `${v.impressionId}:${v.trackId}`;
      if (!uniqueTrackers.has(key)) continue;
      uniqueTrackers.delete(key);
      breakdown[v.ageGroup] = (breakdown[v.ageGroup] ?? 0) + 1;
    }

    return breakdown;
  }

  async getCampaignInsight(campaignId: string) {
    const insight = await this.prisma.campaignInsight.findFirst({
      where:   { campaignId },
      orderBy: { date: 'desc' },
    });

    if (!insight) return null;

    return {
      campaignId:      insight.campaignId,
      date:            insight.date.toISOString().split('T')[0],
      text:            insight.text,
      recommendations: insight.recommendations as string[],
      score:           insight.score,
      grade:           insight.grade as PerformanceGrade,
    };
  }

  // ---------------------------------------------------------------------------
  // Comparison
  // ---------------------------------------------------------------------------

  async getComparison(ids: string[]): Promise<CampaignComparisonItemDto[]> {
    const result: CampaignComparisonItemDto[] = [];

    for (const id of ids) {
      const campaign = await this.prisma.campaign.findUnique({ where: { id } });
      if (!campaign) continue;

      let metric = await this.prisma.campaignMetric.findUnique({ where: { campaignId: id } });
      if (!metric) {
        await this.aggregation.refreshMetric(id);
        metric = await this.prisma.campaignMetric.findUnique({ where: { campaignId: id } });
      }

      result.push({
        campaignId:       id,
        campaignName:     campaign.name,
        impressions:      metric?.totalImpressions   ?? 0,
        reach:            metric?.totalReach         ?? 0,
        avgViewTimeSec:   metric?.avgViewTimeSec     ?? 0,
        attentionRate:    metric?.attentionRate       ?? 0,
        completionRate:   metric?.completionRate      ?? 0,
        performanceScore: metric?.performanceScore   ?? 0,
        engagementScore:  metric?.engagementScore    ?? 0,
        grade:            (metric?.grade as PerformanceGrade) ?? 'WEAK',
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // CSV Export
  // ---------------------------------------------------------------------------

  async exportCsv(campaignId: string): Promise<string> {
    const [campaign, metric, timeline] = await Promise.all([
      this.prisma.campaign.findUnique({ where: { id: campaignId } }),
      this.prisma.campaignMetric.findUnique({ where: { campaignId } }),
      this.getTimeline(campaignId),
    ]);

    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

    const header = 'Date,Impressions,Reach,Avg View Time (s),Attention Rate (%),Completion Rate (%),Avg Audience,Performance Score,Grade\n';
    const rows = timeline.map(t =>
      `${t.date},${t.impressions},${t.reach},${t.avgViewTimeSec},${t.attentionRate},${t.completionRate},${t.avgAudience},${t.performanceScore},${t.grade}`,
    ).join('\n');

    return `Campaign: ${campaign.name}\n\n${header}${rows}`;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private toMetricDto(
    m: any,
    campaignName: string,
    status: string,
    priority: string,
    rank?: number,
  ): any {
    return {
      rank,
      campaignId:       m.campaignId,
      campaignName,
      status,
      priority,
      totalImpressions: m.totalImpressions,
      totalReach:       m.totalReach,
      avgViewTimeSec:   Math.round(m.avgViewTimeSec * 10) / 10,
      attentionRate:    Math.round(m.attentionRate * 10) / 10,
      completionRate:   Math.round(m.completionRate * 10) / 10,
      avgAudience:      Math.round(m.avgAudience * 10) / 10,
      engagementScore:  Math.round(m.engagementScore),
      performanceScore: Math.round(m.performanceScore),
      grade:            m.grade as PerformanceGrade,
      gradeLabel:       GRADE_LABELS[m.grade as PerformanceGrade] ?? m.grade,
      updatedAt:        m.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  private emptyMetricDto(
    campaignId: string,
    campaignName: string,
    status: string,
    priority: string,
  ): CampaignMetricDto {
    return {
      campaignId, campaignName, status, priority,
      totalImpressions: 0, totalReach: 0, avgViewTimeSec: 0,
      attentionRate: 0, completionRate: 0, avgAudience: 0,
      engagementScore: 0, performanceScore: 0,
      grade: 'WEAK', gradeLabel: 'Faible',
      updatedAt: new Date().toISOString(),
    };
  }
}
