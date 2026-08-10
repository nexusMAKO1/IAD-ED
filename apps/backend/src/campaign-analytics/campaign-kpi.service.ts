/**
 * campaign-kpi.service.ts — Pure KPI computation functions
 * IAD Campaign Performance Analytics
 *
 * Engagement Score Formula (documented):
 *   - viewTimeScore  = min(avgViewTimeSec / 30, 1) × 30     → max 30 pts (30-second reference)
 *   - attentionScore = attentionRate × 30                   → max 30 pts
 *   - completionScore= completionRate × 20                  → max 20 pts
 *   - reachScore     = min(reach / max(impressions,1), 1) × 20 → max 20 pts
 *   Total clamped to [0, 100]
 *
 * Performance Score Formula:
 *   - audienceQuality = (reach / max(avgAudience × impressions, 1)) × 100
 *   - performanceScore = engagementScore × 0.6 + min(audienceQuality, 100) × 0.4
 *   Total clamped to [0, 100]
 */

import { Injectable } from '@nestjs/common';
import { PerformanceGrade } from './dto/campaign-analytics.dto';

export interface KpiInputs {
  totalImpressions: number;
  totalReach: number;
  avgViewTimeSec: number;
  attentionRate: number;   // 0–100
  completionRate: number;  // 0–100
  avgAudience: number;
}

export interface KpiScores {
  engagementScore: number;
  performanceScore: number;
  grade: PerformanceGrade;
}

@Injectable()
export class CampaignKpiService {
  computeEngagementScore(inputs: KpiInputs): number {
    const viewTimeScore   = Math.min(inputs.avgViewTimeSec / 30, 1) * 30;
    const attentionScore  = (inputs.attentionRate / 100) * 30;
    const completionScore = (inputs.completionRate / 100) * 20;
    const reachRatio      = inputs.totalImpressions > 0
      ? inputs.totalReach / inputs.totalImpressions
      : 0;
    const reachScore = Math.min(reachRatio, 1) * 20;

    return Math.min(Math.round(viewTimeScore + attentionScore + completionScore + reachScore), 100);
  }

  computePerformanceScore(inputs: KpiInputs, engagementScore: number): number {
    const totalAudienceExposure = inputs.avgAudience * inputs.totalImpressions;
    const audienceQuality = totalAudienceExposure > 0
      ? Math.min((inputs.totalReach / totalAudienceExposure) * 100, 100)
      : 0;

    return Math.min(
      Math.round(engagementScore * 0.6 + audienceQuality * 0.4),
      100,
    );
  }

  computeGrade(score: number): PerformanceGrade {
    if (score >= 85) return 'EXCELLENT';
    if (score >= 70) return 'VERY_GOOD';
    if (score >= 50) return 'GOOD';
    if (score >= 30) return 'AVERAGE';
    return 'WEAK';
  }

  computeAll(inputs: KpiInputs): KpiScores {
    const engagementScore  = this.computeEngagementScore(inputs);
    const performanceScore = this.computePerformanceScore(inputs, engagementScore);
    return {
      engagementScore,
      performanceScore,
      grade: this.computeGrade(performanceScore),
    };
  }

  /** Compute median of a numeric array */
  median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}
