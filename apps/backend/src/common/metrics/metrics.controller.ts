import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { Response } from 'express';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * MetricsController — Prometheus scrape endpoint at GET /metrics.
 *
 * @Controller({ path: 'metrics', version: VERSION_NEUTRAL })
 *   - "path: 'metrics'" : base path agrees with PrometheusModule's default
 *     path option so Reflect.defineMetadata is consistent.
 *   - "version: VERSION_NEUTRAL" : bypasses URI versioning (/v1/) so Prometheus
 *     can reach the endpoint at /metrics rather than /api/v1/metrics.
 *
 * @Get() has NO path arg — the method is at the controller root.
 *
 * main.ts excludes 'metrics' from the global prefix so 'api' is not prepended.
 */
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController extends PrometheusController {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  @Get()
  async index(@Res({ passthrough: true }) response: Response): Promise<string> {
    // Default prom-client metrics (sets Content-Type header via super)
    const baseMetrics = await super.index(response);

    // Prisma connection pool + query latency metrics
    const prismaMetrics = await this.prisma.$metrics.prometheus();

    // Both blocks are valid Prometheus text-format — safe to concatenate
    return `${baseMetrics}\n${prismaMetrics}`;
  }
}
