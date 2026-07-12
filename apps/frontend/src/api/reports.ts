/**
 * api/reports.ts — Reports API calls
 * SmartVision IAD Dashboard
 */

import apiClient from './client';
import type { ReportFilter, ReportRow } from '@/types';

/** GET /api/v1/reports — fetch report rows based on filter */
export async function getReportData(filter: ReportFilter): Promise<ReportRow[]> {
  const { data } = await apiClient.get<ReportRow[]>('/reports', { params: filter });
  return data;
}

/** GET /api/v1/reports/export — export report as blob */
export async function exportReport(
  filter: ReportFilter,
  format: 'csv' | 'xlsx' | 'pdf',
): Promise<Blob> {
  const response = await apiClient.get('/reports/export', {
    params: { ...filter, format },
    responseType: 'blob',
  });
  return response.data as Blob;
}

/** Helper: trigger browser download of exported file */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoke after short delay to ensure the download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
