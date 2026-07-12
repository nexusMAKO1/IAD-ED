/**
 * settings.service.ts — Application Settings Business Logic
 * IAD SmartVision — Singleton pattern: one row in system_settings table
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AppSettings {
  mqtt: {
    host: string;
    port: number;
    username: string;
    password: string;
    websocketPort: number;
  };
  camera: {
    fps: number;
    confidenceThreshold: number;
    detectionInterval: number;
  };
  ageEstimation: {
    enableAgeEstimator: boolean;
    minimumConfidence: number;
  };
  tracking: {
    enableTracking: boolean;
    trackerTimeout: number;
  };
  dashboard: {
    refreshRate: number;
    darkMode: boolean;
  };
  notifications: {
    email: boolean;
    mqtt: boolean;
    websocket: boolean;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  mqtt: {
    host: 'mosquitto',
    port: 1883,
    username: '',
    password: '',
    websocketPort: 9001,
  },
  camera: {
    fps: 30,
    confidenceThreshold: 0.5,
    detectionInterval: 1000,
  },
  ageEstimation: {
    enableAgeEstimator: true,
    minimumConfidence: 0.6,
  },
  tracking: {
    enableTracking: true,
    trackerTimeout: 5000,
  },
  dashboard: {
    refreshRate: 30,
    darkMode: true,
  },
  notifications: {
    email: false,
    mqtt: true,
    websocket: true,
  },
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AppSettings> {
    const record = await this.prisma.systemSettings.findUnique({
      where: { id: 'singleton' },
    });

    if (!record) {
      // Initialise with defaults on first access
      return this.initDefaults();
    }

    // Merge with defaults to ensure all fields exist after schema changes
    return this.mergeWithDefaults(record.settings as Partial<AppSettings>);
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const merged = this.deepMerge(current, patch) as AppSettings;

    await this.prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      update: { settings: merged as any },
      create: { id: 'singleton', settings: merged as any },
    });

    this.logger.log('System settings updated');
    return merged;
  }

  private async initDefaults(): Promise<AppSettings> {
    await this.prisma.systemSettings.create({
      data: { id: 'singleton', settings: DEFAULT_SETTINGS as any },
    });
    this.logger.log('System settings initialised with defaults');
    return DEFAULT_SETTINGS;
  }

  private mergeWithDefaults(partial: Partial<AppSettings>): AppSettings {
    return this.deepMerge(DEFAULT_SETTINGS, partial) as AppSettings;
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key of Object.keys(source ?? {})) {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] ?? {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}
