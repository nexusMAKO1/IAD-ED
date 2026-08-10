/**
 * campaign-view-tracker.service.ts — Real-time view event tracker
 * IAD Campaign Performance Analytics
 *
 * Subscribes to smartvision/edge/detections MQTT topic.
 * For each detection frame, it:
 *   1. Finds the active CampaignImpression for the event's siteId
 *   2. Upserts a CampaignViewEvent keyed on (impressionId, trackId)
 *   3. Updates firstSeenAt/lastSeenAt/dwellSeconds for each tracked person
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt.topics';
import { CampaignImpressionService } from './campaign-impression.service';

@Injectable()
export class CampaignViewTrackerService implements OnModuleInit {
  private readonly logger = new Logger(CampaignViewTrackerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
    private readonly impressionService: CampaignImpressionService,
  ) {}

  onModuleInit() {
    this.logger.log('CampaignViewTrackerService: subscribing to edge detections');
    this.mqttService.subscribe(
      MQTT_TOPICS.EDGE.DETECTIONS,
      async (_topic: string, event: Record<string, unknown>) => {
        await this.handleDetectionEvent(event);
      },
    );
  }

  private async handleDetectionEvent(event: Record<string, unknown>) {
    try {
      const siteId   = event['siteId'] as string | undefined;
      const deviceId = event['deviceId'] as string | undefined;
      const payload  = event['payload'] as Record<string, unknown> | undefined;

      if (!siteId || !deviceId || !payload) return;

      const detections = payload['detections'] as any[] | undefined;
      if (!Array.isArray(detections) || detections.length === 0) return;

      // Find the currently-playing impression for this site
      const impression = await this.impressionService.getActiveImpressionDetails(siteId);
      if (!impression) return;  // No ad playing — nothing to record

      const now = new Date();

      for (const det of detections) {
        const trackId = det['track_id'] as number | undefined;
        if (trackId === undefined || trackId === null) continue;

        const ageGroup = (det['age_group'] as string | undefined) ?? 'unknown';

        // Upsert: create on first sighting, update lastSeenAt and dwellSeconds on repeat
        const existing = await this.prisma.campaignViewEvent.findUnique({
          where: {
            impressionId_trackId: {
              impressionId: impression.id,
              trackId,
            },
          },
        });

        if (!existing) {
          await this.prisma.campaignViewEvent.create({
            data: {
              impressionId:   impression.id,
              trackId,
              ageGroup,
              firstSeenAt:    now,
              lastSeenAt:     now,
              dwellSeconds:   0,
              siteId,
              cameraDeviceId: deviceId,
            },
          });
        } else {
          const dwellSeconds = (now.getTime() - existing.firstSeenAt.getTime()) / 1000;
          await this.prisma.campaignViewEvent.update({
            where: {
              impressionId_trackId: {
                impressionId: impression.id,
                trackId,
              },
            },
            data: {
              lastSeenAt:   now,
              dwellSeconds,
              // Update ageGroup if it becomes known later
              ...(ageGroup !== 'unknown' && { ageGroup }),
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Error tracking view event: ${err.message}`);
    }
  }
}
