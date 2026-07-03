/**
 * types/index.ts — Shared TypeScript types for IAD & SmartQueue frontend
 * T-032 / F4.2 & F4.3
 */

// ─── Enums (mirrored from Prisma) ─────────────────────────────────────────────

export type DeviceType =
  | 'TOTEM'
  | 'SCREEN'
  | 'KIOSK'
  | 'CAMERA'
  | 'WAITING_ROOM_SCREEN'
  | 'TICKET_KIOSK';

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';

export type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT';

// ─── Domain Models ─────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  name: string;
  address: string;
  densityThreshold: number;
  anomalyQueueThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  ipAddress: string | null;
  siteId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── DTOs (Request payloads) ────────────────────────────────────────────────────

export interface UpdateSiteThresholdsPayload {
  densityThreshold: number;
  anomalyQueueThreshold: number;
}

export interface CreateDevicePayload {
  name: string;
  type: DeviceType;
  ipAddress?: string;
  siteId: string;
}

export interface UpdateDevicePayload {
  name?: string;
  type?: DeviceType;
  ipAddress?: string;
  status?: DeviceStatus;
}

// ─── API Error shape ───────────────────────────────────────────────────────────

export interface ApiValidationError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/** Extract field-level error messages from NestJS ValidationPipe responses */
export function extractFieldErrors(
  error: ApiValidationError,
): Record<string, string> {
  const messages = Array.isArray(error.message) ? error.message : [error.message];
  const fieldErrors: Record<string, string> = {};
  for (const msg of messages) {
    // NestJS validation messages have the format "field must be ..."
    const match = /^(\w+)\s/.exec(msg);
    if (match) {
      fieldErrors[match[1]] = msg;
    } else {
      fieldErrors['_general'] = msg;
    }
  }
  return fieldErrors;
}

/** Safely extract a human-readable error message from an unknown error shape */
export function getErrorMessage(error: unknown, fallback = 'Une erreur inattendue est survenue'): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e['error'] === 'string') return e['error'];
    if (typeof e['message'] === 'string') return e['message'];
    if (Array.isArray(e['message']) && typeof e['message'][0] === 'string') return e['message'][0];
  }
  if (typeof error === 'string') return error;
  return fallback;
}
