import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt.topics';
import { CampaignsService } from './campaigns.service';
import { DisplayDevicesService } from '../display-devices/display-devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { DisplayStatus } from '@prisma/client';

interface DecisionState {
  currentCampaignId: string | null;
  lastSwitchTime: number;
  ageWindow: { ts: number; ageGroup: string }[];
  lastDetectionTime: number;
  inactivityTimer: NodeJS.Timeout | null;
}

@Injectable()
export class CampaignDecisionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignDecisionService.name);

  // ── State mapped by deviceId ─────────────────────────────────────────────────
  private stateByDevice = new Map<string, DecisionState>();

  // ── Constants ─────────────────────────────────────────────────────────────
  private readonly CAMPAIGN_COOLDOWN_MS = 15_000;
  private readonly WINDOW_MS = 5_000;
  private readonly INACTIVITY_MS = 30_000;

  constructor(
    private readonly mqttService: MqttService,
    private readonly campaignsService: CampaignsService,
    private readonly displayService: DisplayDevicesService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.logger.log(
      'Campaign Decision Engine subscribing to smartvision/edge/demographics',
    );

    this.mqttService.subscribe(
      MQTT_TOPICS.EDGE.DEMOGRAPHICS,
      async (_topic: string, event: Record<string, any>) => {
        await this.handleDemographicsEvent(event);
      },
    );
  }

  onModuleDestroy() {
    for (const state of this.stateByDevice.values()) {
      if (state.inactivityTimer) clearTimeout(state.inactivityTimer);
    }
  }

  private getState(deviceId: string): DecisionState {
    if (!this.stateByDevice.has(deviceId)) {
      this.stateByDevice.set(deviceId, {
        currentCampaignId: null,
        lastSwitchTime: 0,
        ageWindow: [],
        lastDetectionTime: 0,
        inactivityTimer: null,
      });
    }
    return this.stateByDevice.get(deviceId)!;
  }

  // ── Main handler ────────────────────────────────────────────────────────────
  private async handleDemographicsEvent(event: Record<string, any>) {
    try {
      const payload = event?.payload;
      if (!payload?.age_group) {
        this.logger.debug(
          'Received demographics event with missing payload — skipping.',
        );
        return;
      }

      const deviceId = event.deviceId;
      const siteId = event.siteId;
      if (!deviceId || !siteId) {
        this.logger.warn('Received demographics event without deviceId or siteId — skipping.');
        return;
      }

      const ageGroup: string = payload.age_group as string;
      const now = Date.now();
      
      // Verify that the EdgeDevice is actually paired
      const edgeDevice = await this.prisma.edgeDevice.findUnique({
        where: { deviceId },
      });

      if (!edgeDevice || edgeDevice.status !== DisplayStatus.ONLINE) {
        this.logger.debug(`Camera ${deviceId} is not paired or online. Ignoring demographics.`);
        return;
      }

      const state = this.getState(deviceId);

      // Record detection for inactivity tracking
      state.lastDetectionTime = now;
      this.resetInactivityTimer(deviceId, siteId, state);

      // Add detection to the rolling 5-second window
      state.ageWindow.push({ ts: now, ageGroup });

      // Prune entries older than 5 s
      state.ageWindow = state.ageWindow.filter(
        (e) => now - e.ts <= this.WINDOW_MS,
      );

      // Enforce campaign switch cooldown
      if (now - state.lastSwitchTime < this.CAMPAIGN_COOLDOWN_MS) return;

      // Determine the dominant age over the last 5 s
      const dominant = this.getDominantAge(state.ageWindow);
      if (!dominant) return;

      this.logger.log(`[BACKEND] Detected dominant age group on camera ${deviceId}: ${dominant}`);
      await this.evaluateCampaigns(deviceId, siteId, dominant, state);
    } catch (err: any) {
      this.logger.error(`Error in campaign decision engine: ${err.message}`);
    }
  }

  // ── Find the most frequent age group in the window ─────────────────────────
  private getDominantAge(window: { ts: number; ageGroup: string }[]): string | null {
    if (window.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const { ageGroup } of window) {
      counts[ageGroup] = (counts[ageGroup] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  // ── Campaign selection ──────────────────────────────────────────────────────
  private async evaluateCampaigns(deviceId: string, siteId: string, dominantAgeGroup: string, state: DecisionState) {
    const activeCampaigns = await this.campaignsService.findActive();
    if (activeCampaigns.length === 0) {
      this.logger.warn('No active campaigns found — skipping decision.');
      return;
    }

    let bestCampaign: any = null;
    let highestScore = -Infinity;

    for (const campaign of activeCampaigns) {
      let score = 0;

      // Priority boost
      if (campaign.priority === 'high') score += 10;
      else if (campaign.priority === 'standard') score += 5;

      // Match via targetAge string (primary)
      const targetAge: string | null = campaign.targetAge ?? null;
      if (targetAge) {
        if (targetAge === dominantAgeGroup) {
          score += 20;
        } else if (targetAge !== 'all') {
          score -= 10; // Hard mismatch penalty
        }
      }

      // Match via targetAudience JSON (secondary, e.g. { age_group: "adult" })
      const targetAudience = campaign.targetAudience as Record<
        string,
        any
      > | null;
      if (targetAudience?.age_group === dominantAgeGroup) {
        score += 15;
      }

      if (score > highestScore) {
        highestScore = score;
        bestCampaign = campaign;
      }
    }

    if (!bestCampaign) return;

    // Avoid publishing duplicate commands for the same campaign
    if (bestCampaign.id === state.currentCampaignId) return;

    state.currentCampaignId = bestCampaign.id;
    state.lastSwitchTime = Date.now();

    this.logger.log(
      `[BACKEND] Campaign selected: "${bestCampaign.name}" (score=${highestScore}) for age group "${dominantAgeGroup}" on camera ${deviceId}`,
    );

    const displays = await this.displayService.findAll({ siteId, status: DisplayStatus.ONLINE });
    if (displays.length === 0) {
      this.logger.warn(`No online paired displays found for site ${siteId} — skipping publish.`);
      return;
    }

    for (const display of displays) {
      const topic = MQTT_TOPICS.DISPLAY.COMMANDS(display.deviceId);
      this.logger.log(`[BACKEND] Publishing to ${topic}`);

      this.mqttService.publish(topic, {
        action: 'play',
        campaignId: bestCampaign.id,
        mediaType: bestCampaign.mediaType,
        url: bestCampaign.mediaUrl,
        duration: bestCampaign.duration ?? 15,
      });
    }
  }

  // ── Inactivity: revert to playlist after 30 s with no detections ────────────
  private resetInactivityTimer(deviceId: string, siteId: string, state: DecisionState) {
    if (state.inactivityTimer) clearTimeout(state.inactivityTimer);
    state.inactivityTimer = setTimeout(async () => {
      this.logger.log(
        `[BACKEND] No detections for 30 s on camera ${deviceId} — reverting to default playlist for site ${siteId}.`,
      );
      state.currentCampaignId = null;
      
      try {
        const displays = await this.displayService.findAll({ siteId, status: DisplayStatus.ONLINE });
        for (const display of displays) {
          const topic = MQTT_TOPICS.DISPLAY.COMMANDS(display.deviceId);
          this.mqttService.publish(topic, { action: 'playlist' });
        }
      } catch (err) {
        this.logger.error('Error fetching displays for inactivity revert', err);
      }
    }, this.INACTIVITY_MS);
  }
}
