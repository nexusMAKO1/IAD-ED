import apiClient from './client';

export interface LoginDto {
  email: string;
  password?: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  siteId?: string;
}

export const login = async (data: LoginDto): Promise<AuthTokens> => {
  const response = await apiClient.post<AuthTokens>('/auth/login', data);
  return response.data;
};

export const refresh = async (data: RefreshTokenDto): Promise<AuthTokens> => {
  const response = await apiClient.post<AuthTokens>('/auth/refresh', data);
  return response.data;
};

export const getProfile = async (): Promise<UserProfile> => {
  const response = await apiClient.get<UserProfile>('/auth/profile');
  return response.data;
};

export const logout = async (): Promise<void> => {
  await apiClient.post('/auth/logout');
};
