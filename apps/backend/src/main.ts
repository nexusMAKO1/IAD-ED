/**
 * main.ts — Application Bootstrap Entry Point
 * IAD & SmartQueue AI — Express Display SmartVision (T-012)
 *
 * Configures the global HTTP pipeline with Helmet, CORS, Compression, API versioning,
 * global validation pipes, global exception filters, request logging interceptors,
 * and boots Swagger documentation page at /docs.
 */

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  // Security Middleware
  app.use(helmet());

  // Performance Middleware
  app.use(compression());

  // Enable Cross-Origin Resource Sharing (CORS)
  const corsOrigin = configService.get<string>('cors.origin') ?? '*';
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Route Prefix (exclude /metrics so Prometheus can scrape it at the root)
  app.setGlobalPrefix('api', { exclude: ['metrics'] });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global Pipelines
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not defined in the DTO
      transform: true, // Automatically transform payloads to class instances
      forbidNonWhitelisted: true, // Throw error on unapproved payload parameters
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Filters & Interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger Documentation Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Express Display SmartVision Backend')
    .setDescription(
      'Core business API serving audience statistics, campaigns, tickets, and user access.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Start HTTP Server
  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port);

  logger.log(
    `================================================================`,
  );
  logger.log(
    `  Express Display Backend started successfully on port ${port}  `,
  );
  logger.log(
    `  Environment: ${configService.get<string>('nodeEnv')}          `,
  );
  logger.log(
    `  Swagger API documentation running on: http://localhost:${port}/docs`,
  );
  logger.log(
    `================================================================`,
  );
}

bootstrap().catch((error) => {
  const errLogger = new Logger('Bootstrap');
  errLogger.error(
    'Critical failure during NestJS application bootstrap:',
    error,
  );
  process.exit(1);
});
