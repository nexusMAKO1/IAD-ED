/**
 * audience-events.service.spec.ts — Unit tests for AudienceEventsService.getEvents()
 *
 * Focuses on the gender derivation logic: the service must derive the dominant
 * gender from stored maleCount / femaleCount rather than hardcoding 'unknown'.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AudienceEventsService } from './audience-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { IadMetricsService } from '../common/metrics/iad-metrics.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<{
  id: string; siteId: string; deviceId: string; timestamp: string;
  peopleCount: number; densityScore: number;
  youngCount: number; adultCount: number; seniorCount: number;
  maleCount: number; femaleCount: number;
}> = {}) {
  return {
    id: 'row-1', siteId: 'site-uuid', deviceId: 'cam-01',
    timestamp: new Date().toISOString(),
    peopleCount: 1, densityScore: 0,
    youngCount: 0, adultCount: 1, seniorCount: 0,
    maleCount: 0, femaleCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudienceEventsService — getEvents() gender derivation', () => {
  let service: AudienceEventsService;

  beforeEach(async () => {
    const mockPrisma  = { $queryRaw: jest.fn() };
    const mockMqtt    = { subscribe: jest.fn(), publish: jest.fn() };
    const mockMetrics = {
      peopleDetectedTotal: { inc: jest.fn() },
      currentPeople: { set: jest.fn() },
      ageChild: { inc: jest.fn() }, ageTeen: { inc: jest.fn() },
      ageYoungAdult: { inc: jest.fn() }, ageAdult: { inc: jest.fn() },
      ageSenior: { inc: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudienceEventsService,
        { provide: PrismaService,     useValue: mockPrisma  },
        { provide: MqttService,       useValue: mockMqtt    },
        { provide: IadMetricsService, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<AudienceEventsService>(AudienceEventsService);
    const prisma = module.get(PrismaService);
    (prisma.$queryRaw as jest.Mock).mockImplementation(() => Promise.resolve([]));

    // Re-expose for individual test overrides
    (service as any)._prisma = prisma;
  });

  function setPrismaRows(rows: ReturnType<typeof makeRow>[]) {
    const p: any = (service as any).prisma ?? (service as any)['prisma'];
    if (p) (p.$queryRaw as jest.Mock).mockResolvedValue(rows);
  }

  it('returns gender: "male" when maleCount > femaleCount', async () => {
    const p: any = (service as any).prisma;
    (p.$queryRaw as jest.Mock).mockResolvedValue([makeRow({ maleCount: 3, femaleCount: 1 })]);
    const events = await service.getEvents('site-uuid');
    expect(events[0].gender).toBe('male');
  });

  it('returns gender: "female" when femaleCount > maleCount', async () => {
    const p: any = (service as any).prisma;
    (p.$queryRaw as jest.Mock).mockResolvedValue([makeRow({ maleCount: 1, femaleCount: 4 })]);
    const events = await service.getEvents('site-uuid');
    expect(events[0].gender).toBe('female');
  });

  it('returns gender: "unknown" when both counts are zero (no gender model)', async () => {
    const p: any = (service as any).prisma;
    (p.$queryRaw as jest.Mock).mockResolvedValue([makeRow({ maleCount: 0, femaleCount: 0 })]);
    const events = await service.getEvents('site-uuid');
    expect(events[0].gender).toBe('unknown');
  });

  it('returns gender: "unknown" when maleCount equals femaleCount (ambiguous)', async () => {
    const p: any = (service as any).prisma;
    (p.$queryRaw as jest.Mock).mockResolvedValue([makeRow({ maleCount: 2, femaleCount: 2 })]);
    const events = await service.getEvents('site-uuid');
    expect(events[0].gender).toBe('unknown');
  });

  it('preserves ageGroup derivation alongside gender fix', async () => {
    const p: any = (service as any).prisma;
    (p.$queryRaw as jest.Mock).mockResolvedValue([
      makeRow({ youngCount: 0, adultCount: 5, seniorCount: 2, maleCount: 3, femaleCount: 1 }),
    ]);
    const events = await service.getEvents('site-uuid');
    expect(events[0].ageGroup).toBe('adult');
    expect(events[0].gender).toBe('male');
  });

  it('returns empty array when no events exist', async () => {
    const p: any = (service as any).prisma;
    (p.$queryRaw as jest.Mock).mockResolvedValue([]);
    const events = await service.getEvents('site-uuid');
    expect(events).toHaveLength(0);
  });
});
