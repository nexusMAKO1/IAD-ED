import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt.topics';
import { CampaignsService } from './campaigns.service';

@Injectable()
export class CampaignDecisionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignDecisionService.name);

  // ── Current playback state ─────────────────────────────────────────────────
  private currentCampaignId: string | null = null;

  // ── Campaign switch cooldown: minimum 15 s between campaign changes ─────────
  private readonly CAMPAIGN_COOLDOWN_MS = 15_000;
  private lastSwitchTime = 0;

  // ── 5-second dominant-age sliding window ────────────────────────────────────
  private readonly WINDOW_MS = 5_000;
  private ageWindow: { ts: number; ageGroup: string }[] = [];

  // ── Inactivity: revert to default playlist after 30 s of no detections ─────
  private readonly INACTIVITY_MS = 30_000;
  private lastDetectionTime = 0;
  private inactivityTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly mqttService: MqttService,
    private readonly campaignsService: CampaignsService,
  ) {}

  onModuleInit() {
    this.logger.log('Campaign Decision Engine subscribing to smartvision/edge/demographics');

    this.mqttService.subscribe(
      MQTT_TOPICS.EDGE.DEMOGRAPHICS,
      async (_topic: string, event: Record<string, any>) => {
        await this.handleDemographicsEvent(event);
      },
    );
  }

  onModuleDestroy() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
  }

  // ── Main handler ────────────────────────────────────────────────────────────
  private async handleDemographicsEvent(event: Record<string, any>) {
    try {
      const payload = event?.payload;
      if (!payload?.age_group) {
        this.logger.debug('Received demographics event with missing payload — skipping.');
        return;
      }

      const ageGroup: string = payload.age_group as string;
      const now = Date.now();

      // Record detection for inactivity tracking
      this.lastDetectionTime = now;
      this.resetInactivityTimer();

      // Add detection to the rolling 5-second window
      this.ageWindow.push({ ts: now, ageGroup });

      // Prune entries older than 5 s
      this.ageWindow = this.ageWindow.filter((e) => now - e.ts <= this.WINDOW_MS);

      // Enforce campaign switch cooldown
      if (now - this.lastSwitchTime < this.CAMPAIGN_COOLDOWN_MS) return;

      // Determine the dominant age over the last 5 s
      const dominant = this.getDominantAge();
      if (!dominant) return;

      this.logger.log(`[BACKEND] Detected dominant age group: ${dominant}`);
      await this.evaluateCampaigns(dominant);
    } catch (err: any) {
      this.logger.error(`Error in campaign decision engine: ${err.message}`);
    }
  }

  // ── Find the most frequent age group in the window ─────────────────────────
  private getDominantAge(): string | null {
    if (this.ageWindow.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const { ageGroup } of this.ageWindow) {
      counts[ageGroup] = (counts[ageGroup] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  // ── Campaign selection ──────────────────────────────────────────────────────
  private async evaluateCampaigns(dominantAgeGroup: string) {
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
      const targetAudience = campaign.targetAudience as Record<string, any> | null;
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
    if (bestCampaign.id === this.currentCampaignId) return;

    this.currentCampaignId = bestCampaign.id;
    this.lastSwitchTime = Date.now();

    this.logger.log(
      `[BACKEND] Campaign selected: "${bestCampaign.name}" (score=${highestScore}) for age group "${dominantAgeGroup}"`,
    );
    this.logger.log(`[BACKEND] Publishing to smartvision/display/commands`);

    this.mqttService.publish(MQTT_TOPICS.DISPLAY.COMMANDS, {
      action: 'play',
      campaignId: bestCampaign.id,
      mediaType: bestCampaign.mediaType,
      url: bestCampaign.mediaUrl,
      duration: bestCampaign.duration ?? 15,
    });
  }

  // ── Inactivity: revert to playlist after 30 s with no detections ────────────
  private resetInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => {
      this.logger.log('[BACKEND] No detections for 30 s — reverting to default playlist.');
      this.currentCampaignId = null;
      this.mqttService.publish(MQTT_TOPICS.DISPLAY.COMMANDS, { action: 'playlist' });
    }, this.INACTIVITY_MS);
  }
}
