import { Test, TestingModule } from '@nestjs/testing';
import { CampaignAnalyticsController } from './campaign-analytics.controller';
import { CampaignAnalyticsService } from './campaign-analytics.service';
import { PerformanceGrade } from './dto/campaign-analytics.dto';

describe('CampaignAnalyticsController', () => {
  let controller: CampaignAnalyticsController;
  let service: CampaignAnalyticsService;

  const mockAnalyticsService = {
    getOverview: jest.fn(),
    getLeaderboard: jest.fn(),
    getComparison: jest.fn(),
    getCampaignPerformance: jest.fn(),
    getCampaignDetail: jest.fn(),
    getTimeline: jest.fn(),
    getAudienceBreakdown: jest.fn(),
    getCampaignInsight: jest.fn(),
    exportCsv: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignAnalyticsController],
      providers: [
        { provide: CampaignAnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();

    controller = module.get<CampaignAnalyticsController>(CampaignAnalyticsController);
    service = module.get<CampaignAnalyticsService>(CampaignAnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return overview data', async () => {
      const mockResult = { activeCampaigns: 5, totalImpressions: 1000 };
      mockAnalyticsService.getOverview.mockResolvedValue(mockResult);

      const result = await controller.getOverview();
      expect(result).toEqual(mockResult);
      expect(mockAnalyticsService.getOverview).toHaveBeenCalled();
    });
  });

  describe('getComparison', () => {
    it('should split ids and call service', async () => {
      const mockResult = [{ campaignId: '1' }, { campaignId: '2' }];
      mockAnalyticsService.getComparison.mockResolvedValue(mockResult);

      const result = await controller.getComparison({ ids: '1,2, 3 ' });
      
      expect(mockAnalyticsService.getComparison).toHaveBeenCalledWith(['1', '2', '3']);
      expect(result).toEqual(mockResult);
    });
  });

  describe('exportData', () => {
    it('should return CSV data with correct headers', async () => {
      const mockCsv = 'col1,col2\nval1,val2';
      mockAnalyticsService.exportCsv.mockResolvedValue(mockCsv);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.exportData('123', { format: 'csv' }, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="campaign-123-analytics.csv"');
      expect(mockRes.send).toHaveBeenCalledWith(mockCsv);
    });
  });
});
