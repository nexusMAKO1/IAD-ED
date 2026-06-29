/**
 * current-user.decorator.ts — Current User Param Decorator
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 *
 * Extracts the authenticated user from the request object.
 * Must be used on routes protected by JwtAuthGuard.
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();
    return request.user;
  },
);
