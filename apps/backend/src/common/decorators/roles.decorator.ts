/**
 * roles.decorator.ts — Roles Metadata Decorator
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 *
 * Attaches allowed roles metadata to route handlers so RolesGuard
 * can read and enforce them.
 */

import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict a route to specific UserRoles.
 *
 * @example
 * @Roles(UserRole.ADMIN, UserRole.MANAGER)
 * @Get('sensitive-endpoint')
 * getSensitiveData() {}
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
