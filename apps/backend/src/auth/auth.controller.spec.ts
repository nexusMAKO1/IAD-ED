/**
 * auth.controller.spec.ts — AuthController Unit Tests
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should invoke authService.login', async () => {
      const loginDto = {
        email: 'admin@expressdisplay.com',
        password: 'Password123!',
      };
      const expectedResponse = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'uuid-1', email: loginDto.email, role: UserRole.ADMIN },
      };
      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResponse);
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('refresh', () => {
    it('should invoke authService.refresh', async () => {
      const dto = { refreshToken: 'refresh-token-value' };
      const expectedResponse = {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      };
      mockAuthService.refresh.mockResolvedValue(expectedResponse);

      const result = await controller.refresh(dto);

      expect(result).toEqual(expectedResponse);
      expect(service.refresh).toHaveBeenCalledWith(dto.refreshToken);
    });
  });

  describe('getProfile', () => {
    it('should format profile info from the current user decorator', () => {
      const mockPayload = {
        sub: 'user-uuid-1',
        email: 'agent@expressdisplay.com',
        role: UserRole.AGENT,
        siteId: 'site-uuid-1',
      };

      const result = controller.getProfile(mockPayload);

      expect(result).toEqual({
        id: 'user-uuid-1',
        email: 'agent@expressdisplay.com',
        role: UserRole.AGENT,
        siteId: 'site-uuid-1',
      });
    });
  });

  describe('logout', () => {
    it('should return logout success message', () => {
      expect(controller.logout()).toEqual({
        message: 'Logged out successfully',
      });
    });
  });
});
