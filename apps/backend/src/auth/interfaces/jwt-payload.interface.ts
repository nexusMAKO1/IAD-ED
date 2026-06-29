/**
 * jwt-payload.interface.ts — JWT Payload Shape
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 */

import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string; // User UUID
  email: string;
  role: UserRole;
  siteId: string | null;
  iat?: number; // Issued at (set by JWT library)
  exp?: number; // Expiry (set by JWT library)
}
