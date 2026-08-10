/**
 * campaign-impression.service.ts — Impression lifecycle manager
 * IAD Campaign Performance Analytics
 *
 * Subscribes to `smartvision/display/+/commands` MQTT topic.
 * - action:'play'     → opens a new CampaignImpression record
 * - action:'playlist' → closes the active impression for that display
 * - Next play event   → also closes any open impression before opening the new one
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class CampaignImpressionService implements OnModuleInit {
  private readonly logger = new Logger(CampaignImpressionService.name);

  /**
   * Track the currently-open impression per display (deviceId → impressionId).
   * This is an in-memory map that is repopulated on restart from PLAYING rows.
   */
  private activeImpressions = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
  ) {}

  async onModuleInit() {
    this.logger.log('CampaignImpressionService: subscribing to display commands');

    // Use raw (unvalidated) handler because display commands are NOT wrapped in
    // a BaseEventDto envelope — they are published directly by the backend itself.
    this.mqttService.subscribeUnvalidated(
      'smartvision/display/+/commands',
      async (topic: string, payload: Record<string, unknown>) => {
        await this.handleDisplayCommand(topic, payload);
      },
    );

    // Recover any impressions that were PLAYING when the backend last crashed
    await this.recoverActiveImpressions();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async handleDisplayCommand(
    topic: string,
    payload: Record<string, unknown>,
  ) {
    try {
      const action = payload['action'] as string | undefined;
      if (!action) return;

      // Extract display hardware deviceId from topic:
      // smartvision/display/<deviceId>/commands
      const parts = topic.split('/');
      const displayHwId = parts[2];
      if (!displayHwId) return;

      if (action === 'play') {
        await this.handlePlay(displayHwId, payload);
      } else if (action === 'playlist') {
        await this.handlePlaylistRevert(displayHwId);
      }
    } catch (err: any) {
      this.logger.error(`Error handling display command: ${err.message}`);
    }
  }

  private async handlePlay(
    displayHwId: string,
    payload: Record<string, unknown>,
  ) {
    const campaignId = payload['campaignId'] as string | undefined;
    if (!campaignId) return;

    // Close previous impression for this display
    await this.closeActiveImpression(displayHwId, 'COMPLETED');

    // Resolve the display's database record
    const displayDevice = await this.prisma.device.findUnique({
      where: { deviceId: displayHwId },
    });
    if (!displayDevice) {
      this.logger.warn(`Display device ${displayHwId} not found in DB — skipping impression`);
      return;
    }
    if (!displayDevice.siteId) {
      this.logger.warn(`Display ${displayHwId} has no siteId — skipping impression`);
      return;
    }

    const impression = await this.prisma.campaignImpression.create({
      data: {
        campaignId,
        displayDeviceId: displayDevice.id,
        siteId:          displayDevice.siteId,
        plannedDurationSec: (payload['duration'] as number | undefined) ?? 15,
        mediaType:          (payload['mediaType'] as string | undefined) ?? 'video',
        priority:           (payload['priority'] as string | undefined) ?? 'standard',
        status: 'PLAYING',
      },
    });

    this.activeImpressions.set(displayHwId, impression.id);
    this.logger.debug(
      `Impression ${impression.id} opened for campaign ${campaignId} on display ${displayHwId}`,
    );
  }

  private async handlePlaylistRevert(displayHwId: string) {
    await this.closeActiveImpression(displayHwId, 'COMPLETED');
  }

  private async closeActiveImpression(
    displayHwId: string,
    status: 'COMPLETED' | 'INTERRUPTED',
  ) {
    const impressionId = this.activeImpressions.get(displayHwId);
    if (!impressionId) return;

    await this.prisma.campaignImpression.update({
      where: { id: impressionId },
      data:  { status, endedAt: new Date() },
    });

    this.activeImpressions.delete(displayHwId);
    this.logger.debug(`Impression ${impressionId} closed (${status})`);
  }

  private async recoverActiveImpressions() {
    const playing = await this.prisma.campaignImpression.findMany({
      where: { status: 'PLAYING' },
      include: { campaign: false },
    });

    for (const imp of playing) {
      // We need the hardware deviceId from displayDeviceId (DB UUID)
      const device = await this.prisma.device.findUnique({
        where: { id: imp.displayDeviceId },
      });
      if (device) {
        this.activeImpressions.set(device.deviceId, imp.id);
        this.logger.debug(`Recovered impression ${imp.id} for display ${device.deviceId}`);
      }
    }

    this.logger.log(
      `Recovered ${this.activeImpressions.size} active impressions from DB`,
    );
  }

  // ---------------------------------------------------------------------------
  // Public API used by CampaignViewTrackerService
  // ---------------------------------------------------------------------------

  /**
   * Returns the currently-open impression ID for a given siteId,
   * so view events can be linked to the right impression.
   */
  async getActiveImpressionForSite(siteId: string): Promise<string | null> {
    // Find any PLAYING impression on this site
    const imp = await this.prisma.campaignImpression.findFirst({
      where: { siteId, status: 'PLAYING' },
      orderBy: { startedAt: 'desc' },
    });
    return imp?.id ?? null;
  }

  async getActiveImpressionDetails(
    siteId: string,
  ): Promise<{ id: string; plannedDurationSec: number } | null> {
    const imp = await this.prisma.campaignImpression.findFirst({
      where:   { siteId, status: 'PLAYING' },
      orderBy: { startedAt: 'desc' },
      select:  { id: true, plannedDurationSec: true },
    });
    return imp ?? null;
  }
}
