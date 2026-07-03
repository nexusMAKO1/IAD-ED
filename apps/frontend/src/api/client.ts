/**
 * api/client.ts — Configured Axios HTTP client
 * T-032
 *
 * Reads auth token from localStorage and attaches it as a Bearer token.
 * Interceptors handle global error normalisation.
 */

import axios, { type AxiosError } from 'axios';
import type { ApiValidationError } from '@/types';

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

// ─── Request interceptor — attach JWT if present ──────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — normalise errors ─────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiValidationError>) => {
    // Re-throw with the structured body so callers can inspect field errors
    return Promise.reject(error.response?.data ?? error);
  },
);

export default apiClient;
