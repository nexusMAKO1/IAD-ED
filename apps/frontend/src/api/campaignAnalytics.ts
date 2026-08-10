import apiClient from './client';
import {
  CampaignOverviewDto,
  CampaignLeaderboardItemDto,
  CampaignMetricDto,
  CampaignDetailResponseDto,
  CampaignDailyStatDto,
  CampaignInsightDto,
  CampaignComparisonItemDto,
} from '../types';

export const campaignAnalyticsApi = {
  getOverview: async (): Promise<CampaignOverviewDto> => {
    const { data } = await apiClient.get('/campaigns/performance');
    return data;
  },

  getLeaderboard: async (): Promise<CampaignLeaderboardItemDto[]> => {
    const { data } = await apiClient.get('/campaigns/leaderboard');
    return data;
  },

  getCampaignPerformance: async (id: string): Promise<CampaignMetricDto> => {
    const { data } = await apiClient.get(`/campaigns/${id}/performance`);
    return data;
  },

  getCampaignDetail: async (id: string): Promise<CampaignDetailResponseDto> => {
    const { data } = await apiClient.get(`/campaigns/${id}/analytics`);
    return data;
  },

  getTimeline: async (id: string): Promise<CampaignDailyStatDto[]> => {
    const { data } = await apiClient.get(`/campaigns/${id}/timeline`);
    return data;
  },

  getAudience: async (id: string): Promise<Record<string, number>> => {
    const { data } = await apiClient.get(`/campaigns/${id}/audience`);
    return data;
  },

  getInsights: async (id: string): Promise<CampaignInsightDto | null> => {
    const { data } = await apiClient.get(`/campaigns/${id}/insights`);
    return data;
  },

  getComparison: async (ids: string[]): Promise<CampaignComparisonItemDto[]> => {
    const { data } = await apiClient.get('/campaigns/comparison', {
      params: { ids: ids.join(',') },
    });
    return data;
  },

  exportCsvUrl: (id: string) => {
    return `${apiClient.defaults.baseURL}/campaigns/${id}/export?format=csv`;
  },
};
