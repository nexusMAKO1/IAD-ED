/**
 * campaign-analytics.dto.ts — Response DTOs for Campaign Performance Analytics
 * IAD SmartVision
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type PerformanceGrade =
  | 'EXCELLENT'
  | 'VERY_GOOD'
  | 'GOOD'
  | 'AVERAGE'
  | 'WEAK';

export const GRADE_LABELS: Record<PerformanceGrade, string> = {
  EXCELLENT: 'Excellent',
  VERY_GOOD: 'Très bon',
  GOOD: 'Bon',
  AVERAGE: 'Moyen',
  WEAK: 'Faible',
};

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

export class ComparisonQueryDto {
  @ApiProperty({ example: 'id1,id2,id3', description: 'Comma-separated campaign IDs' })
  @IsString()
  ids!: string;
}

export class ExportQueryDto {
  @ApiProperty({ enum: ['csv', 'pdf', 'xlsx'], default: 'csv' })
  @IsIn(['csv', 'pdf', 'xlsx'])
  @IsOptional()
  format?: 'csv' | 'pdf' | 'xlsx' = 'csv';
}

// ---------------------------------------------------------------------------
// Core DTOs
// ---------------------------------------------------------------------------

export class AudienceBreakdownDto {
  @ApiProperty() child!: number;
  @ApiProperty() youngAdult!: number;
  @ApiProperty() adult!: number;
  @ApiProperty() senior!: number;
}

export class ViewTimeStatsDto {
  @ApiProperty() avg!: number;
  @ApiProperty() median!: number;
  @ApiProperty() min!: number;
  @ApiProperty() max!: number;
}

export class PeakHourDto {
  @ApiProperty() hour!: number;
  @ApiProperty() label!: string;
  @ApiProperty() impressions!: number;
}

export class CampaignMetricDto {
  @ApiProperty() campaignId!: string;
  @ApiProperty() campaignName!: string;
  @ApiProperty() status!: string;
  @ApiProperty() priority!: string;
  @ApiProperty() totalImpressions!: number;
  @ApiProperty() totalReach!: number;
  @ApiProperty() avgViewTimeSec!: number;
  @ApiProperty() attentionRate!: number;
  @ApiProperty() completionRate!: number;
  @ApiProperty() avgAudience!: number;
  @ApiProperty() engagementScore!: number;
  @ApiProperty() performanceScore!: number;
  @ApiProperty() grade!: PerformanceGrade;
  @ApiProperty() gradeLabel!: string;
  @ApiProperty() updatedAt!: string;
}

export class CampaignDailyStatDto {
  @ApiProperty() date!: string;
  @ApiProperty() impressions!: number;
  @ApiProperty() reach!: number;
  @ApiProperty() avgViewTimeSec!: number;
  @ApiProperty() attentionRate!: number;
  @ApiProperty() completionRate!: number;
  @ApiProperty() avgAudience!: number;
  @ApiProperty() engagementScore!: number;
  @ApiProperty() performanceScore!: number;
  @ApiProperty() grade!: PerformanceGrade;
}

export class CampaignInsightDto {
  @ApiProperty() campaignId!: string;
  @ApiProperty() date!: string;
  @ApiProperty() text!: string;
  @ApiProperty({ type: [String] }) recommendations!: string[];
  @ApiProperty() score!: number;
  @ApiProperty() grade!: PerformanceGrade;
}

export class CampaignDetailResponseDto {
  @ApiProperty() campaign!: Record<string, unknown>;
  @ApiProperty() metrics!: CampaignMetricDto;
  @ApiProperty() viewTimeStats!: ViewTimeStatsDto;
  @ApiProperty() audienceBreakdown!: AudienceBreakdownDto;
  @ApiProperty({ type: [PeakHourDto] }) peakHours!: PeakHourDto[];
  @ApiProperty({ type: [CampaignDailyStatDto] }) timeline!: CampaignDailyStatDto[];
  @ApiPropertyOptional() latestInsight?: CampaignInsightDto;
}

export class CampaignLeaderboardItemDto extends CampaignMetricDto {
  @ApiProperty() rank!: number;
}

export class CampaignOverviewDto {
  @ApiProperty() totalCampaigns!: number;
  @ApiProperty() activeCampaigns!: number;
  @ApiProperty() totalImpressions!: number;
  @ApiProperty() totalReach!: number;
  @ApiProperty() avgViewTimeSec!: number;
  @ApiProperty() avgAttentionRate!: number;
  @ApiProperty() avgPerformanceScore!: number;
  @ApiPropertyOptional() bestCampaign?: CampaignMetricDto;
  @ApiPropertyOptional() worstCampaign?: CampaignMetricDto;
  @ApiProperty({ type: [CampaignLeaderboardItemDto] }) leaderboard!: CampaignLeaderboardItemDto[];
}

export class CampaignComparisonItemDto {
  @ApiProperty() campaignId!: string;
  @ApiProperty() campaignName!: string;
  @ApiProperty() impressions!: number;
  @ApiProperty() reach!: number;
  @ApiProperty() avgViewTimeSec!: number;
  @ApiProperty() attentionRate!: number;
  @ApiProperty() completionRate!: number;
  @ApiProperty() performanceScore!: number;
  @ApiProperty() engagementScore!: number;
  @ApiProperty() grade!: PerformanceGrade;
}
