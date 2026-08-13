/**
 * jwt-auth.guard.ts — JWT Authentication Guard
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 *
 * Route guard that requires requests to have a valid Bearer JWT token.
 * Leverages passport-jwt strategy.
 */

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw new UnauthorizedException(
        info?.message ?? 'Vous devez être connecté pour accéder à cette ressource',
      );
    }
    return user;
  }
}
