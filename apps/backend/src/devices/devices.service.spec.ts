/**
 * devices.service.spec.ts — Tests unitaires de DevicesService
 * T-032 / F4.2
 *
 * Exécuter : npm run test -- --testPathPattern=devices.service.spec
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DeviceStatus, DeviceType } from '@prisma/client';
import { DevicesService } from './devices.service';
import { SitesService } from '../sites/sites.service';
import { PrismaService } from '../prisma/prisma.service';

const mockSite = {
  id: 'site-uuid-1234',
  name: 'Test Site',
  address: '1 rue de la Paix',
  densityThreshold: 10,
  anomalyQueueThreshold: 15,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDevice = {
  id: 'device-uuid-5678',
  name: 'Totem Entrée',
  type: DeviceType.TOTEM,
  status: DeviceStatus.OFFLINE,
  ipAddress: null,
  siteId: 'site-uuid-1234',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrismaService = {
  device: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockSitesService = {
  findOne: jest.fn(),
};

describe('DevicesService', () => {
  let service: DevicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SitesService, useValue: mockSitesService },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create a device when site exists and DTO is valid', async () => {
      mockSitesService.findOne.mockResolvedValue(mockSite);
      mockPrismaService.device.create.mockResolvedValue(mockDevice);

      const dto = {
        name: 'Totem Entrée',
        type: DeviceType.TOTEM,
        siteId: 'site-uuid-1234',
      };
      const result = await service.create(dto);

      expect(mockSitesService.findOne).toHaveBeenCalledWith('site-uuid-1234');
      expect(mockPrismaService.device.create).toHaveBeenCalledWith({
        data: {
          name: 'Totem Entrée',
          type: DeviceType.TOTEM,
          ipAddress: null,
          siteId: 'site-uuid-1234',
        },
        include: { site: { select: { id: true, name: true } } },
      });
      expect(result).toEqual(mockDevice);
    });

    it('should throw NotFoundException when siteId does not exist', async () => {
      mockSitesService.findOne.mockRejectedValue(
        new NotFoundException('Site introuvable'),
      );
      await expect(
        service.create({
          name: 'Test',
          type: DeviceType.SCREEN,
          siteId: 'bad-uuid',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.device.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('should only include provided fields in the update data', async () => {
      mockPrismaService.device.findUnique.mockResolvedValue(mockDevice);
      mockPrismaService.device.update.mockResolvedValue({
        ...mockDevice,
        name: 'Totem Hall B',
      });

      await service.update('device-uuid-5678', { name: 'Totem Hall B' });

      const callArgs = mockPrismaService.device.update.mock.calls[0][0];
      expect(callArgs.data).toEqual({ name: 'Totem Hall B' });
      expect(callArgs.data).not.toHaveProperty('type');
      expect(callArgs.data).not.toHaveProperty('status');
      expect(callArgs.data).not.toHaveProperty('ipAddress');
    });

    it('should throw BadRequestException when empty DTO is provided', async () => {
      mockPrismaService.device.findUnique.mockResolvedValue(mockDevice);
      await expect(service.update('device-uuid-5678', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.device.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when device id does not exist', async () => {
      mockPrismaService.device.findUnique.mockResolvedValue(null);
      await expect(
        service.update('nonexistent', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('should delete the device when it exists', async () => {
      mockPrismaService.device.findUnique.mockResolvedValue(mockDevice);
      mockPrismaService.device.delete.mockResolvedValue(mockDevice);

      await service.remove('device-uuid-5678');

      expect(mockPrismaService.device.delete).toHaveBeenCalledWith({
        where: { id: 'device-uuid-5678' },
      });
    });

    it('should NOT call delete and throw NotFoundException when device does not exist', async () => {
      mockPrismaService.device.findUnique.mockResolvedValue(null);
      await expect(service.remove('ghost-uuid')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.device.delete).not.toHaveBeenCalled();
    });
  });

  describe('findBySite()', () => {
    it('should validate site existence before querying devices', async () => {
      mockSitesService.findOne.mockResolvedValue(mockSite);
      mockPrismaService.device.findMany.mockResolvedValue([mockDevice]);

      const result = await service.findBySite('site-uuid-1234');

      expect(mockSitesService.findOne).toHaveBeenCalledWith('site-uuid-1234');
      expect(mockPrismaService.device.findMany).toHaveBeenCalledWith({
        where: { siteId: 'site-uuid-1234' },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([mockDevice]);
    });

    it('should propagate NotFoundException when site does not exist', async () => {
      mockSitesService.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.findBySite('unknown-site')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.device.findMany).not.toHaveBeenCalled();
    });
  });
});
