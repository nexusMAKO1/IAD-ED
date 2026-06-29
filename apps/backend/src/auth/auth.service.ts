/**
 * auth.service.ts — Authentication Business Logic
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validate user credentials.
   * Compares provided password against bcrypt hashed password.
   */
  async validateUser(dto: LoginDto): Promise<User> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      this.logger.warn(
        `Failed login attempt for non-existent email: ${dto.email}`,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      this.logger.warn(`Failed login attempt for user: ${dto.email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  /**
   * Process a login request and return access + refresh tokens.
   */
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto);
    const tokens = await this.generateTokens(user);

    this.logger.log(`User logged in: ${user.email} (${user.id})`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Verify a refresh token and generate a new access token.
   */
  async refresh(refreshToken: string) {
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ??
        this.configService.get<string>('JWT_SECRET') ??
        'fallback-refresh-secret';

      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }

      // Generate new access and refresh tokens
      const tokens = await this.generateTokens(user);

      this.logger.log(`Refreshed access token for user: ${user.email}`);
      return tokens;
    } catch (exc) {
      this.logger.warn(
        `Invalid or expired refresh token: ${exc instanceof Error ? exc.message : exc}`,
      );
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Helper to sign access and refresh tokens.
   */
  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      siteId: user.siteId,
    };

    const jwtSecret =
      this.configService.get<string>('JWT_SECRET') ?? 'fallback-jwt-secret';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ?? jwtSecret;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: this.configService.get<any>('JWT_EXPIRES_IN') ?? '3600s',
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn:
          this.configService.get<any>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
