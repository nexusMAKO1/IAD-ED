import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AlertsService, AlertItem, MAX_ALERT_CACHE_SIZE } from './alerts.service';
import { MqttService } from '../mqtt/mqtt.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('AlertsService', () => {
  let service: AlertsService;

  const mockMqttService = {
    subscribe: jest.fn(),
  };

  const inMemoryAlerts = new Map<string, any>();

  const mockPrismaService = {
    alert: {
      findMany: jest.fn(async (args?: any) => {
        let items = Array.from(inMemoryAlerts.values());
        if (args?.where?.siteId) {
          items = items.filter((i) => i.siteId === args.where.siteId);
        }
        if (args?.where?.severity) {
          items = items.filter((i) => i.severity === args.where.severity);
        }
        if (args?.where?.acknowledged !== undefined) {
          items = items.filter((i) => i.acknowledged === args.where.acknowledged);
        }
        if (args?.take) {
          items = items.slice(0, args.take);
        }
        return items;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return inMemoryAlerts.get(where.id) || null;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = inMemoryAlerts.get(where.id);
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() };
          inMemoryAlerts.set(where.id, updated);
          return updated;
        }
        const created = { ...create, createdAt: new Date(), updatedAt: new Date() };
        inMemoryAlerts.set(where.id, created);
        return created;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = inMemoryAlerts.get(where.id);
        if (!existing) throw new Error('Record not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        inMemoryAlerts.set(where.id, updated);
        return updated;
      }),
      delete: jest.fn(async ({ where }: any) => {
        const existing = inMemoryAlerts.get(where.id);
        if (!existing) throw new Error('Record not found');
        inMemoryAlerts.delete(where.id);
        return existing;
      }),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, def?: any) => def),
  };

  beforeAll(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'acknowledged' }),
    });
  });

  beforeEach(async () => {
    inMemoryAlerts.clear();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: MqttService, useValue: mockMqttService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    await service.onModuleInit();
  });

  describe('SmartQueue Proxy Configuration', () => {
    it('uses fallback URL http://smartqueue-ml:8002 when no config is provided', () => {
      expect(service.getSmartQueueUrl()).toBe('http://smartqueue-ml:8002');
    });

    it('respects SMARTQUEUE_URL or ML_SERVICE_URL override', async () => {
      const customConfig = {
        get: jest.fn((key: string) => {
          if (key === 'ML_SERVICE_URL') return 'http://custom-ml:9099/';
          return undefined;
        }),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AlertsService,
          { provide: MqttService, useValue: mockMqttService },
          { provide: ConfigService, useValue: customConfig },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      const customService = module.get<AlertsService>(AlertsService);
      expect(customService.getSmartQueueUrl()).toBe('http://custom-ml:9099');
    });

    it('handles SmartQueue downstream HTTP errors without throwing', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await service.handleIncomingAlert({ id: 'err-1', message: 'Test error alert' });
      const mockUser = { sub: 'u1', email: 'op@test.com', role: UserRole.ADMIN, siteId: null };

      const ack = await service.acknowledge('err-1', mockUser);
      expect(ack.acknowledged).toBe(true);
      expect(ack.acknowledgedBy).toBe('op@test.com');
    });

    it('handles SmartQueue connection timeouts and network errors gracefully', async () => {
      (global as any).fetch = jest.fn().mockRejectedValue(new Error('Connection timed out'));

      await service.handleIncomingAlert({ id: 'timeout-1', message: 'Timeout alert' });
      const mockUser = { sub: 'u1', email: 'op@test.com', role: UserRole.ADMIN, siteId: null };

      const ack = await service.acknowledge('timeout-1', mockUser);
      expect(ack.acknowledged).toBe(true);
    });
  });

  describe('Durable Persistence and Alert Lifecycle', () => {
    it('persists incoming MQTT alerts into database', async () => {
      const subscribeCallback = mockMqttService.subscribe.mock.calls[0][1];
      await subscribeCallback('smartvision/backend/alerts', {
        id: 'persisted-1',
        payload: {
          type: 'high_density',
          severity: 'critical',
          message: 'Foule dense détectée',
          siteId: 'site-a',
        },
        timestamp: new Date().toISOString(),
      });

      expect(mockPrismaService.alert.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'persisted-1' },
        }),
      );

      const found = await service.findOne('persisted-1');
      expect(found).toBeDefined();
      expect(found.id).toBe('persisted-1');
      expect(found.severity).toBe('critical');
    });

    it('preloads existing alerts from database on init (restart recovery)', async () => {
      // Seed pre-existing alert in DB
      inMemoryAlerts.set('restart-1', {
        id: 'restart-1',
        type: 'queue_surge',
        severity: 'warning',
        message: 'File d attente anormale',
        timestamp: new Date(),
        acknowledged: false,
      });

      const newModule: TestingModule = await Test.createTestingModule({
        providers: [
          AlertsService,
          { provide: MqttService, useValue: mockMqttService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      const rebootedService = newModule.get<AlertsService>(AlertsService);
      await rebootedService.onModuleInit();

      const retrieved = await rebootedService.findOne('restart-1');
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe('restart-1');
    });

    it('filters alerts and enforces query limits', async () => {
      await service.handleIncomingAlert({ id: 'a1', siteId: 'site-1', severity: 'warning' });
      await service.handleIncomingAlert({ id: 'a2', siteId: 'site-2', severity: 'critical' });
      await service.handleIncomingAlert({ id: 'a3', siteId: 'site-1', severity: 'critical' });

      const site1 = await service.findAll({ siteId: 'site-1' });
      expect(site1).toHaveLength(2);

      const criticalOnly = await service.findAll({ severity: 'critical' });
      expect(criticalOnly).toHaveLength(2);

      const limited = await service.findAll({ limit: 1 });
      expect(limited).toHaveLength(1);
    });

    it('acknowledges alerts and records verified operator identity', async () => {
      await service.handleIncomingAlert({ id: 'ack-test', message: 'Needs operator' });
      const mockUser = { sub: 'usr-99', email: 'agent@iad.fr', role: UserRole.AGENT, siteId: null };

      const ack = await service.acknowledge('ack-test', mockUser);
      expect(ack.acknowledged).toBe(true);
      expect(ack.acknowledgedBy).toBe('agent@iad.fr');
      expect(ack.acknowledgedAt).toBeDefined();

      expect(mockPrismaService.alert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ack-test' },
          data: expect.objectContaining({
            acknowledged: true,
            acknowledgedBy: 'agent@iad.fr',
          }),
        }),
      );
    });

    it('deletes alerts from storage and cache', async () => {
      await service.handleIncomingAlert({ id: 'del-1', message: 'To be deleted' });
      await service.delete('del-1');

      await expect(service.findOne('del-1')).rejects.toThrow(NotFoundException);
    });
  });
});
