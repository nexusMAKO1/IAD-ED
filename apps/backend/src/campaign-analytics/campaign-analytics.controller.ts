/**
 * campaign-analytics.controller.ts — REST API for Campaign Performance Analytics
 * IAD SmartVision
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CampaignAnalyticsService } from './campaign-analytics.service';
import { ComparisonQueryDto, ExportQueryDto } from './dto/campaign-analytics.dto';

@ApiTags('campaign-analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignAnalyticsController {
  constructor(private readonly analytics: CampaignAnalyticsService) {}

  // ---------------------------------------------------------------------------
  // Collection endpoints
  // ---------------------------------------------------------------------------

  @Get('performance')
  @ApiOperation({ summary: 'Get performance overview for all campaigns' })
  async getOverview() {
    return this.analytics.getOverview();
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get campaigns ranked by performance score (descending)' })
  async getLeaderboard() {
    return this.analytics.getLeaderboard();
  }

  @Get('comparison')
  @ApiOperation({ summary: 'Side-by-side KPI comparison for selected campaigns' })
  @ApiQuery({ name: 'ids', description: 'Comma-separated campaign UUIDs', required: true })
  async getComparison(@Query() query: ComparisonQueryDto) {
    const ids = query.ids.split(',').map(id => id.trim()).filter(Boolean);
    return this.analytics.getComparison(ids);
  }

  // ---------------------------------------------------------------------------
  // Per-campaign endpoints
  // ---------------------------------------------------------------------------

  @Get(':id/performance')
  @ApiOperation({ summary: 'Get rolling KPI metrics for a specific campaign' })
  async getCampaignPerformance(@Param('id') id: string) {
    return this.analytics.getCampaignPerformance(id);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get full performance detail (metrics + breakdown + timeline + insight)' })
  async getCampaignDetail(@Param('id') id: string) {
    return this.analytics.getCampaignDetail(id);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get daily statistics timeline (last 30 days)' })
  async getTimeline(@Param('id') id: string) {
    return this.analytics.getTimeline(id);
  }

  @Get(':id/audience')
  @ApiOperation({ summary: 'Get audience age breakdown for a campaign' })
  async getAudience(@Param('id') id: string) {
    return this.analytics.getAudienceBreakdown(id);
  }

  @Get(':id/insights')
  @ApiOperation({ summary: 'Get latest AI-generated insight for a campaign' })
  async getInsight(@Param('id') id: string) {
    return this.analytics.getCampaignInsight(id);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export campaign performance data (csv)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'pdf', 'xlsx'], required: false })
  async exportData(
    @Param('id') id: string,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    const format = query.format ?? 'csv';
    const csv = await this.analytics.exportCsv(id);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="campaign-${id}-analytics.csv"`,
    );
    res.send(csv);
  }
}
