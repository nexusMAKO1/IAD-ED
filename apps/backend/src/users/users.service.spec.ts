/**
 * users.service.spec.ts — UsersService Unit Tests
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'test@expressdisplay.com',
    password: 'hashed-password',
    role: UserRole.AGENT,
    siteId: 'site-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return a user if found by email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@expressdisplay.com');
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@expressdisplay.com' },
      });
    });

    it('should return null if user is not found by email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('missing@expressdisplay.com');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user if found by ID', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-uuid-1');
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
    });

    it('should throw NotFoundException if user is not found by ID', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const createUserDto = {
      email: 'new@expressdisplay.com',
      password: 'SecurePassword123!',
      role: UserRole.AGENT,
      siteId: 'site-uuid-1',
    };

    it('should hash password and create a new user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        email: createUserDto.email,
      });

      const bcryptHashSpy = jest.spyOn(bcrypt, 'hash');

      const result = await service.create(createUserDto);

      expect(result.email).toBe(createUserDto.email);
      expect(bcryptHashSpy).toHaveBeenCalledWith(createUserDto.password, 12);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email is already registered', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
