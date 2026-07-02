import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { PrismaService } from '../../prisma/prisma.service';

@Controller()
export class MetricsController extends PrometheusController {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  @Get('metrics')
  async index(@Res({ passthrough: true }) res: Response) {
    // Get default metrics from prom-client (registry)
    const defaultMetrics = await super.index(res);
    
    // Get Prisma metrics
    const prismaMetrics = await this.prisma.$metrics.prometheus();
    
    // Combine both strings (they are just text-based Prometheus format)
    // The super.index sets the content-type, we just return the concatenated string
    const combined = `${defaultMetrics}\n${prismaMetrics}`;
    
    res.send(combined);
  }
}
