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
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { DeviceRegistryService } from './device-registry.service';

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
  deviceId: 'totem-5678',
  name: 'Totem Entrée',
  type: DeviceType.TOTEM,
  status: DeviceStatus.ONLINE,
  ip: null,
  siteId: 'site-uuid-1234',
  lastHeartbeat: new Date(),
  lastSeen: new Date(),
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
  site: {
    findUnique: jest.fn(),
  },
};

const mockMqttService = {
  publish: jest.fn(),
};

const mockDeviceRegistryService = {
  assignToSite: jest.fn(),
};

describe('DevicesService', () => {
  let service: DevicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MqttService, useValue: mockMqttService },
        { provide: DeviceRegistryService, useValue: mockDeviceRegistryService },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create a device when site exists and DTO is valid', async () => {
      mockPrismaService.site.findUnique.mockResolvedValue(mockSite);
      mockPrismaService.device.create.mockResolvedValue(mockDevice);

      const dto = {
        name: 'Totem Entrée',
        type: DeviceType.TOTEM,
        siteId: 'site-uuid-1234',
      };
      const result = await service.create(dto);

      expect(mockPrismaService.site.findUnique).toHaveBeenCalledWith({
        where: { id: 'site-uuid-1234' },
      });
      expect(mockPrismaService.device.create).toHaveBeenCalled();
      expect(result).toEqual(mockDevice);
    });

    it('should throw NotFoundException when siteId does not exist', async () => {
      mockPrismaService.site.findUnique.mockResolvedValue(null);
      await expect(
        service.create({
          name: 'Test',
          type: DeviceType.DISPLAY,
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
      expect(callArgs.data.name).toEqual('Totem Hall B');
      expect(callArgs.data.type).toBeUndefined();
      expect(callArgs.data.status).toBeUndefined();
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
      mockPrismaService.site.findUnique.mockResolvedValue(mockSite);
      mockPrismaService.device.findMany.mockResolvedValue([mockDevice]);

      const result = await service.findBySite('site-uuid-1234');

      expect(mockPrismaService.site.findUnique).toHaveBeenCalledWith({
        where: { id: 'site-uuid-1234' },
      });
      expect(mockPrismaService.device.findMany).toHaveBeenCalledWith({
        where: { siteId: 'site-uuid-1234' },
        include: {
          site: { select: { id: true, name: true } },
          cameraMetadata: true,
          displayMetadata: true,
        },
        orderBy: { name: 'asc' },
      });
      expect(result[0].deviceId).toEqual(mockDevice.deviceId);
    });

    it('should propagate NotFoundException when site does not exist', async () => {
      mockPrismaService.site.findUnique.mockResolvedValue(null);
      await expect(service.findBySite('unknown-site')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.device.findMany).not.toHaveBeenCalled();
    });
  });
});
