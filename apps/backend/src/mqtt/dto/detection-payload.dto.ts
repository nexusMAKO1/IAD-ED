/**
 * detection-payload.dto.ts — Detection Event DTO
 * Express Display SmartVision — T-021
 */

import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { BaseEventDto } from './base-event.dto';

export class DetectionBoundingBoxDto {
  @IsNumber()
  x1!: number;

  @IsNumber()
  y1!: number;

  @IsNumber()
  x2!: number;

  @IsNumber()
  y2!: number;

  @IsNumber()
  @Min(0)
  confidence!: number;

  @IsOptional()
  @IsInt()
  trackId?: number;

  @IsOptional()
  @IsString()
  label?: string;
}

export class DetectionPayloadDto extends BaseEventDto {
  declare payload: {
    personCount: number;
    inferenceMsec: number;
    processingMsec: number;
    detections: DetectionBoundingBoxDto[];
  };
}

export class TrackingPayloadDto extends BaseEventDto {
  declare payload: {
    activeCount: number;
    trackIds: number[];
    fps: number;
  };
}

export class DemographicsPayloadDto extends BaseEventDto {
  declare payload: {
    personCount: number;
    demographics: Array<{
      trackId: number;
      estimatedAge: number | null;
      ageGroup: string | null;
      confidence: number;
    }>;
  };
}

export class PerformancePayloadDto extends BaseEventDto {
  declare payload: {
    fps: number;
    inferenceMsec: number;
    processingMsec: number;
    cpuPercent?: number;
    memoryBytes?: number;
  };
}

export class CrowdDensityPayloadDto extends BaseEventDto {
  declare payload: {
    count: number;
    density: 'low' | 'medium' | 'high' | 'critical';
    zoneId?: string;
  };
}

export class HealthPayloadDto extends BaseEventDto {
  declare payload: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    serviceName: string;
    uptime?: number;
    metrics?: Record<string, number>;
  };
}

export class CameraHealthPayloadDto extends BaseEventDto {
  declare payload: {
    online: boolean;
    source: string;
    resolution?: string;
    fps?: number;
  };
}
