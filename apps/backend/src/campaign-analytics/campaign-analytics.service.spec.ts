import { Test, TestingModule } from '@nestjs/testing';
import { CampaignAnalyticsService } from './campaign-analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignAggregationService } from './campaign-aggregation.service';
import { CampaignKpiService } from './campaign-kpi.service';
import { CampaignInsightsService } from './campaign-insights.service';
import { PerformanceGrade } from './dto/campaign-analytics.dto';
import { NotFoundException } from '@nestjs/common';

describe('CampaignAnalyticsService', () => {
  let service: CampaignAnalyticsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    campaign: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    campaignMetric: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    campaignDailyStatistic: {
      findMany: jest.fn(),
    },
  };

  const mockAggregationService = {
    refreshMetric: jest.fn(),
  };

  const mockKpiService = {
    calculatePerformanceScore: jest.fn(),
    calculateEngagementScore: jest.fn(),
  };

  const mockInsightsService = {
    generateInsight: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignAnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CampaignAggregationService, useValue: mockAggregationService },
        { provide: CampaignKpiService, useValue: mockKpiService },
        { provide: CampaignInsightsService, useValue: mockInsightsService },
      ],
    }).compile();

    service = module.get<CampaignAnalyticsService>(CampaignAnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return overview metrics and trigger refresh for missing ones', async () => {
      const mockCampaigns = [
        { id: '1', name: 'Campaign 1', status: 'active', priority: 'high', active: true },
        { id: '2', name: 'Campaign 2', status: 'active', priority: 'low', active: true },
      ];

      const mockMetrics = [
        {
          campaignId: '1',
          totalImpressions: 100,
          totalReach: 50,
          avgViewTimeSec: 10,
          attentionRate: 50,
          completionRate: 30,
          avgAudience: 5,
          engagementScore: 70,
          performanceScore: 80,
          grade: 'VERY_GOOD' as const,
          campaign: mockCampaigns[0],
        },
      ];

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaignMetric.findMany.mockResolvedValueOnce(mockMetrics);
      mockPrismaService.campaignMetric.findMany.mockResolvedValueOnce([
        ...mockMetrics,
        { ...mockMetrics[0], campaignId: '2', campaign: mockCampaigns[1], performanceScore: 50 },
      ]);

      const result = await service.getOverview();

      expect(mockAggregationService.refreshMetric).toHaveBeenCalledWith('2');
      expect(result.activeCampaigns).toBe(2);
      expect(result.totalImpressions).toBe(200); // 100 + 100
    });
  });

  describe('getLeaderboard', () => {
    it('should return ranked campaigns', async () => {
      mockPrismaService.campaignMetric.findMany.mockResolvedValue([
        {
          campaignId: '1',
          performanceScore: 90,
          grade: 'EXCELLENT' as const,
          campaign: { name: 'A', status: 'active' },
        },
        {
          campaignId: '2',
          performanceScore: 40,
          grade: 'AVERAGE' as const,
          campaign: { name: 'B', status: 'active' },
        },
      ]);

      const result = await service.getLeaderboard();
      expect(result).toHaveLength(2);
      expect(result[0].performanceScore).toBe(90);
    });
  });

  describe('getCampaignPerformance', () => {
    it('should return performance for a valid campaign and refresh if missing', async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue({ id: '1', name: 'A' });
      // First call returns null, second call returns metric
      mockPrismaService.campaignMetric.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          campaignId: '1',
          totalImpressions: 10,
          grade: 'GOOD' as const
        });

      const result = await service.getCampaignPerformance('1');
      expect(result.grade).toBe('GOOD');
      expect(mockAggregationService.refreshMetric).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException for invalid campaign', async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(null);
      await expect(service.getCampaignPerformance('invalid')).rejects.toThrow(NotFoundException);
    });
  });
});
