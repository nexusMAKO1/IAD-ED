/**
 * health.controller.ts — Health Check Endpoint
 * IAD & SmartQueue AI — Express Display SmartVision (T-012)
 */

import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { HeartbeatMonitorService } from './heartbeat-monitor.service';

interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

@ApiTags('System')
@Controller({ path: 'system', version: '1' })
export class SystemController {
  constructor(private readonly heartbeatMonitor: HeartbeatMonitorService) {}

  @Get('heartbeat-monitor')
  @ApiOperation({ summary: 'Heartbeat Monitor Diagnostics' })
  getHeartbeatMonitorDiagnostics() {
    return this.heartbeatMonitor.getDiagnostics();
  }
}

@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Service health check' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      example: {
        status: 'ok',
        service: 'backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    },
  })
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
