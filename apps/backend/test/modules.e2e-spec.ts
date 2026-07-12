// Set mock env-vars before AppModule loads
process.env.DATABASE_URL = 'postgresql://mockuser:mockpass@localhost:5432/mockdb';
process.env.JWT_SECRET = 'CHANGE_ME_JWT_SECRET_MUST_BE_AT_LEAST_64_CHARS_LONG_RANDOM_STRING_FOR_TESTS';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('Modules (e2e) - Sites, Devices, Settings', () => {
  let app: INestApplication;
  let accessToken: string;

  const mockUser = {
    id: '123e4567-e89b-42d3-a456-426614174001',
    email: 'admin@expressdisplay.com',
    password: '', // will be hashed
    role: UserRole.ADMIN,
    siteId: '123e4567-e89b-42d3-a456-426614174000',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSite = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    name: 'Test Site',
    address: '123 Test Ave',
    densityThreshold: 100,
    anomalyQueueThreshold: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDevice = {
    id: 'device-123',
    name: 'Test Camera',
    type: 'CAMERA',
    status: 'ONLINE',
    siteId: mockSite.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue(mockUser),
      findUniqueOrThrow: jest.fn().mockResolvedValue(mockUser),
    },
    site: {
      findMany: jest.fn().mockResolvedValue([mockSite]),
      findUnique: jest.fn().mockResolvedValue(mockSite),
      create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'new-site-id', ...args.data, createdAt: new Date(), updatedAt: new Date() })),
      update: jest.fn().mockImplementation((args) => Promise.resolve({ ...mockSite, ...args.data })),
      delete: jest.fn().mockResolvedValue(mockSite),
    },
    device: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([mockDevice]),
      findUnique: jest.fn().mockResolvedValue(mockDevice),
      create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'new-dev-id', ...args.data, createdAt: new Date(), updatedAt: new Date() })),
      update: jest.fn().mockImplementation((args) => Promise.resolve({ ...mockDevice, ...args.data })),
      delete: jest.fn().mockResolvedValue(mockDevice),
    },
    systemSettings: {
      findUnique: jest.fn().mockResolvedValue({ id: 'singleton', settings: { dashboard: { darkMode: true } } }),
      upsert: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'singleton', settings: args.update.settings })),
    },
    $connect: jest.fn().mockResolvedValue(null),
    $disconnect: jest.fn().mockResolvedValue(null),
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  beforeAll(async () => {
    mockUser.password = await bcrypt.hash('AdminSecurePassword123!', 12);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    // Perform login to get token
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@expressdisplay.com', password: 'AdminSecurePassword123!' });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Sites Module', () => {
    it('GET /api/v1/sites - should list all sites', () => {
      return request(app.getHttpServer())
        .get('/api/v1/sites')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0]).toHaveProperty('name', 'Test Site');
        });
    });

    it('POST /api/v1/sites - should create a site', () => {
      return request(app.getHttpServer())
        .post('/api/v1/sites')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'New Site', address: '123 New St' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 'new-site-id');
          expect(res.body).toHaveProperty('name', 'New Site');
        });
    });

    it('PATCH /api/v1/sites/:id/thresholds - should update a site thresholds', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/sites/${mockSite.id}/thresholds`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ densityThreshold: 150 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('densityThreshold', 150);
        });
    });

    it('DELETE /api/v1/sites/:id - should delete a site', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/sites/${mockSite.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });
  });

  describe('Devices Module', () => {
    it('GET /api/v1/devices - should list all devices', () => {
      return request(app.getHttpServer())
        .get('/api/v1/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0]).toHaveProperty('name', 'Test Camera');
        });
    });

    it('POST /api/v1/devices - should create a device', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'New Cam', type: 'CAMERA', siteId: mockSite.id });
      if (res.status !== 201) console.error('POST DEVICES FAILED', res.body);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('name', 'New Cam');
      expect(res.body).toHaveProperty('type', 'CAMERA');
    });
  });

  describe('Settings Module', () => {
    it('GET /api/v1/settings - should fetch settings', () => {
      return request(app.getHttpServer())
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('PATCH /api/v1/settings - should update settings', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ dashboard: { darkMode: false } })
        .expect(200);
    });
  });
});
