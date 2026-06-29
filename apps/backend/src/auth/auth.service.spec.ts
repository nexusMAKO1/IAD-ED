/**
 * auth.service.spec.ts — AuthService Unit Tests
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'admin@expressdisplay.com',
    password: 'hashed-password',
    role: UserRole.ADMIN,
    siteId: 'site-uuid-1',
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'supersecret-jwt-key';
      if (key === 'JWT_EXPIRES_IN') return '3600s';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user object if credentials are correct', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true));

      const result = await service.validateUser({
        email: 'admin@expressdisplay.com',
        password: 'Password123!',
      });

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false));

      await expect(
        service.validateUser({
          email: 'admin@expressdisplay.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if email not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser({
          email: 'missing@expressdisplay.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return access and refresh tokens on successful login', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(mockUser as any);
      mockJwtService.signAsync
        .mockResolvedValueOnce('accessTokenValue')
        .mockResolvedValueOnce('refreshTokenValue');

      const result = await service.login({
        email: 'admin@expressdisplay.com',
        password: 'Password123!',
      });

      expect(result).toEqual({
        accessToken: 'accessTokenValue',
        refreshToken: 'refreshTokenValue',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        },
      });
    });
  });

  describe('refresh', () => {
    it('should verify refresh token and generate new tokens', async () => {
      const payload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        siteId: mockUser.siteId,
      };
      mockJwtService.verify.mockReturnValue(payload);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockJwtService.signAsync
        .mockResolvedValueOnce('newAccessToken')
        .mockResolvedValueOnce('newRefreshToken');

      const result = await service.refresh('valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'newAccessToken',
        refreshToken: 'newRefreshToken',
      });
      expect(mockUsersService.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw UnauthorizedException if token verification fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refresh('invalid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
