/**
 * jwt.strategy.ts — Passport JWT Strategy
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 *
 * Decodes and validates incoming JWT tokens using Passport.
 * Merges decoded payloads onto the Request as request.user.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ??
        'fallback-jwt-secret-key-at-least-64-chars',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('Format du token invalide');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      siteId: payload.siteId,
    };
  }
}
