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
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
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
    let user: User | null = null;
    try {
      user = await this.usersService.findByEmail(dto.email);
    } catch (error) {
      this.logger.error(
        `Database error during user lookup for email: ${dto.email}`,
        error instanceof Error ? error.stack : error,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user) {
      this.logger.warn(
        `Failed login attempt for non-existent email: ${dto.email}`,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.password) {
      this.logger.error(
        `User record missing password field for email: ${dto.email}`,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    try {
      const passwordMatch = await bcrypt.compare(dto.password, user.password);
      if (!passwordMatch) {
        this.logger.warn(`Failed login attempt for user: ${dto.email}`);
        throw new UnauthorizedException('Invalid email or password');
      }
    } catch (error) {
      this.logger.error(
        `Bcrypt compare error for user: ${dto.email}`,
        error instanceof Error ? error.stack : error,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  /**
   * Process a login request and return access + refresh tokens.
   */
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto);

    try {
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
    } catch (error) {
      this.logger.error(
        `Token generation failed for user: ${user.email}`,
        error instanceof Error ? error.stack : error,
      );
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Verify a refresh token and generate a new access token.
   */
  async refresh(refreshToken: string) {
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ??
        this.configService.get<string>('JWT_SECRET') ??
        'fallback-jwt-secret-key-at-least-64-chars';

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
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findById(userId);

    // Verify old password
    const passwordMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!passwordMatch) {
      this.logger.warn(
        `Failed password change attempt (invalid old password) for user: ${user.email}`,
      );
      throw new UnauthorizedException('Invalid current password');
    }

    // Hash new password and update
    await this.usersService.update(userId, { password: dto.newPassword });

    this.logger.log(`Password updated for user: ${user.email}`);

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  /**
   * Retrieve full user profile from DB (includes name).
   */
  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      id: user.id,
      name: user.name ?? null,
      email: user.email,
      role: user.role,
      siteId: user.siteId ?? null,
      createdAt: user.createdAt,
    };
  }

  /**
   * Update user profile (name and/or email).
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.usersService.update(userId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
    });
    return {
      id: user.id,
      name: user.name ?? null,
      email: user.email,
      role: user.role,
      siteId: user.siteId ?? null,
      createdAt: user.createdAt,
    };
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
      this.configService.get<string>('JWT_SECRET') ??
      'fallback-jwt-secret-key-at-least-64-chars';
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
