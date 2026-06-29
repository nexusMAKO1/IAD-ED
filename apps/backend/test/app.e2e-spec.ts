// Set mock env-vars before AppModule loads to satisfy ConfigModule validation
process.env.DATABASE_URL =
  'postgresql://mockuser:mockpass@localhost:5432/mockdb';
process.env.JWT_SECRET =
  'CHANGE_ME_JWT_SECRET_MUST_BE_AT_LEAST_64_CHARS_LONG_RANDOM_STRING_FOR_TESTS';

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  const mockUser = {
    id: '11111111-2222-3333-4444-555555555555',
    email: 'admin@expressdisplay.com',
    password: 'hashed-secure-password-1234567890',
    role: UserRole.ADMIN,
    siteId: '00000000-1111-2222-3333-444444444444',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn((query) => {
        if (
          query.where.email === mockUser.email ||
          query.where.id === mockUser.id
        ) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      }),
      findUniqueOrThrow: jest.fn((query) => {
        if (query.where.id === mockUser.id) {
          return Promise.resolve(mockUser);
        }
        return Promise.reject(new Error('User not found'));
      }),
      findById: jest.fn(),
    },
    $connect: jest.fn().mockResolvedValue(null),
    $disconnect: jest.fn().mockResolvedValue(null),
  };

  beforeAll(async () => {
    // Hash mockUser's password for successful authentication matching
    mockUser.password = await bcrypt.hash('AdminSecurePassword123!', 12);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Wire main app options to match main.ts
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('service', 'backend');
        expect(res.body).toHaveProperty('version');
      });
  });

  describe('Auth Flow', () => {
    let accessToken: string;
    let refreshToken: string;

    it('should fail login with wrong credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@expressdisplay.com',
          password: 'WrongPassword!',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty(
            'message',
            'Invalid email or password',
          );
        });
    });

    it('should log in successfully with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@expressdisplay.com',
          password: 'AdminSecurePassword123!',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body.user).toHaveProperty(
            'email',
            'admin@expressdisplay.com',
          );
          expect(res.body.user).toHaveProperty('role', 'ADMIN');
          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it('should refuse profile access without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .expect(401);
    });

    it('should allow profile access with valid access token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', 'admin@expressdisplay.com');
          expect(res.body).toHaveProperty('role', 'ADMIN');
          expect(res.body).toHaveProperty('id', mockUser.id);
        });
    });

    it('should successfully rotate tokens with /refresh', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
        });
    });

    it('should perform logout successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message', 'Logged out successfully');
        });
    });
  });
});
