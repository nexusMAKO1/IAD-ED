import apiClient from './client';

export interface Campaign {
  id: string;
  name: string;
  mediaUrl: string;
  mediaType: string;
  duration: number;
  targetAudience: Record<string, any>;
  targetAge: string | null;
  targetGender: string | null;
  targetEmotion: string | null;
  priority: string;
  enabled: boolean;
  playlistOrder: number;
  startDate: string | null;
  endDate: string | null;
  sites: string[];
  createdAt?: string;
}

export const getCampaigns = async (): Promise<Campaign[]> => {
  const { data } = await apiClient.get<Campaign[]>('/campaigns');
  return data;
};

export const deleteCampaign = async (id: string) => {
  return apiClient.delete(`/campaigns/${id}`);
};

export const updateCampaignOrder = async (id: string, playlistOrder: number) => {
  return apiClient.patch(`/campaigns/${id}`, { playlistOrder });
};

export const updateCampaign = async (id: string, payload: Partial<Campaign>) => {
  return apiClient.patch(`/campaigns/${id}`, payload);
};

export const createCampaign = async (payload: Omit<Campaign, 'id'>) => {
  return apiClient.post('/campaigns', payload);
};

export const uploadCampaignMedia = async (form: FormData): Promise<{ url: string; filename: string; size: number }> => {
  const { data } = await apiClient.post<{ url: string; filename: string; size: number }>('/campaigns/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};
