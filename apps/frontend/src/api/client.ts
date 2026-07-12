/**
 * api/client.ts — Configured Axios HTTP client
 * T-032
 *
 * Reads auth token from localStorage and attaches it as a Bearer token.
 * Interceptors handle global error normalisation.
 */

import axios, { type AxiosError } from 'axios';
import type { ApiValidationError } from '@/types';

const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1';

const apiClient = axios.create({
  baseURL: apiBase,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

// In-memory token storage
let currentAccessToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void; }> = [];

export const setAccessToken = (token: string | null) => {
  currentAccessToken = token;
};

export const getAccessToken = () => currentAccessToken;

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ─── Request interceptor — attach JWT if present ──────────────────────────────
apiClient.interceptors.request.use((config) => {
  if (currentAccessToken) {
    config.headers.set('Authorization', `Bearer ${currentAccessToken}`);
  }
  return config;
});

// ─── Response interceptor — normalise errors and retry on 401 ────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiValidationError>) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh') {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.set('Authorization', 'Bearer ' + token);
          return apiClient(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        // No refresh token available, logout immediately
        setAccessToken(null);
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error.response?.data ?? error);
      }

      try {
        // We import axios directly to avoid interceptor loop
        const { data } = await axios.post(`${apiBase}/auth/refresh`, { refreshToken });
        setAccessToken(data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);
        
        // Notify React context if needed
        window.dispatchEvent(new CustomEvent('auth:refresh', { detail: data }));
        
        processQueue(null, data.accessToken);
        
        originalRequest.headers.set('Authorization', 'Bearer ' + data.accessToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        localStorage.removeItem('refresh_token');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Re-throw with the structured body so callers can inspect field errors
    return Promise.reject(error.response?.data ?? error);
  },
);

export default apiClient;
