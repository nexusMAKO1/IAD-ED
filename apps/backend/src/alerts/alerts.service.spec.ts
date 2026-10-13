import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AlertsService } from './alerts.service';
import { MqttService } from '../mqtt/mqtt.service';
import { UserRole } from '@prisma/client';

describe('AlertsService', () => {
  let service: AlertsService;

  const mockMqttService = {
    subscribe: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, def?: any) => def),
  };

  beforeAll(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'acknowledged' }),
    });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: MqttService, useValue: mockMqttService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    jest.clearAllMocks();
    service = module.get<AlertsService>(AlertsService);
    service.onModuleInit();
  });

  it('subscribes to MQTT alerts topic on init', () => {
    expect(mockMqttService.subscribe).toHaveBeenCalled();
  });

  it('ingests and filters alerts correctly', () => {
    // Simulate MQTT message arrival
    const subscribeCallback = mockMqttService.subscribe.mock.calls[0][1];
    subscribeCallback('smartvision/backend/alerts', {
      id: 'a1',
      payload: {
        type: 'high_density',
        severity: 'critical',
        message: 'Foule dense détectée',
        siteId: 'site-1',
      },
      timestamp: new Date().toISOString(),
    });

    const all = service.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('a1');
    expect(all[0].severity).toBe('critical');

    const bySite = service.findAll({ siteId: 'site-1' });
    expect(bySite).toHaveLength(1);

    const otherSite = service.findAll({ siteId: 'site-2' });
    expect(otherSite).toHaveLength(0);
  });

  it('securely acknowledges an alert with verified operator identity', async () => {
    const subscribeCallback = mockMqttService.subscribe.mock.calls[0][1];
    subscribeCallback('smartvision/backend/alerts', {
      id: 'a2',
      payload: {
        type: 'camera_offline',
        severity: 'warning',
        message: 'Camera hors ligne',
      },
    });

    const mockUser = {
      sub: 'usr-123',
      email: 'operator@smartvision.fr',
      role: UserRole.MANAGER,
      siteId: null,
    };

    const acknowledged = await service.acknowledge('a2', mockUser);
    expect(acknowledged.acknowledged).toBe(true);
    expect(acknowledged.acknowledgedBy).toBe('operator@smartvision.fr');
    expect(acknowledged.acknowledgedAt).toBeDefined();
  });
});
