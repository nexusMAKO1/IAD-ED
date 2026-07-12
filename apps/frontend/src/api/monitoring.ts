/**
 * api/monitoring.ts — Infrastructure Monitoring API calls
 * SmartVision IAD Dashboard
 */

import apiClient from './client';
import type { MonitoringService } from '@/types';

/** GET /api/v1/health — backend health check with service statuses */
export async function getMonitoringStatus(): Promise<MonitoringService[]> {
  const { data } = await apiClient.get<MonitoringService[]>('/health');
  return data;
}

/** GET /api/v1/health/metrics — Prometheus-style metrics summary */
export async function getHealthMetrics(): Promise<Record<string, number>> {
  const { data } = await apiClient.get<Record<string, number>>('/health/metrics');
  return data;
}
