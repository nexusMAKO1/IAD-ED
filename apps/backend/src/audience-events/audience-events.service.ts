import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt.topics';
import { IadMetricsService } from '../common/metrics/iad-metrics.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DetectionsPayloadDto } from './dto/edge-payloads.dto';

@Injectable()
export class AudienceEventsService implements OnModuleInit {
  private readonly logger = new Logger(AudienceEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
    private readonly iadMetrics: IadMetricsService,
  ) {}

  onModuleInit() {
    this.logger.log('Subscribing to Edge-CV detection events');
    this.mqttService.subscribe(MQTT_TOPICS.EDGE.DETECTIONS, async (topic, eventStr) => {
      await this.handleDetectionEvent(eventStr);
    });
  }

  private async handleDetectionEvent(event: Record<string, any>) {
    try {
      const payload = event.payload;
      if (!payload) return;

      const dto = plainToInstance(DetectionsPayloadDto, payload);
      const errors = await validate(dto);
      if (errors.length > 0) {
        this.logger.warn(`Invalid detection payload structure`);
        return;
      }

      const siteId = event.siteId;
      const deviceId = event.deviceId;
      // Using new Date() instead of event.timestamp string as Prisma expects Date
      const timestamp = new Date(event.timestamp);

      let youngCount = 0;
      let adultCount = 0;
      let seniorCount = 0;

      for (const det of dto.detections) {
        const group = det.age_group;
        if (group === 'child' || group === 'teen' || group === 'young_adult') {
          youngCount++;
        } else if (group === 'adult') {
          adultCount++;
        } else if (group === 'senior') {
          seniorCount++;
        } else {
          // default to adult if unknown
          adultCount++;
        }
      }

      const peopleCount = dto.personCount;
      const densityScore = 0.0;
      const avgDwellTime = 0.0;

      await this.prisma.audienceEvent.create({
        data: {
          siteId,
          deviceId,
          timestamp,
          peopleCount,
          youngCount,
          adultCount,
          seniorCount,
          densityScore,
          avgDwellTime,
        },
      });

      // Update Prometheus metrics
      this.iadMetrics.peopleDetectedTotal.inc({ siteId, deviceId }, peopleCount);
      this.iadMetrics.currentPeople.set({ siteId, deviceId }, peopleCount);
      if (youngCount > 0) {
        for (const det of dto.detections) {
          const group = det.age_group;
          if (group === 'child') this.iadMetrics.ageChild.inc({ siteId, deviceId });
          else if (group === 'teen') this.iadMetrics.ageTeen.inc({ siteId, deviceId });
          else if (group === 'young_adult') this.iadMetrics.ageYoungAdult.inc({ siteId, deviceId });
        }
      }
      if (adultCount > 0) this.iadMetrics.ageAdult.inc({ siteId, deviceId }, adultCount);
      if (seniorCount > 0) this.iadMetrics.ageSenior.inc({ siteId, deviceId }, seniorCount);

      this.logger.debug(`Ingested audience event for site ${siteId} (${peopleCount} people)`);
    } catch (err: any) {
      this.logger.error(`Error processing audience event: ${err.message}`);
    }
  }

  async getLatestStats(siteId: string) {
    // Use raw SQL because TimescaleDB hypertable partitioning can cause Prisma
    // aggregate/findFirst to miss records without an explicit time constraint.

    const [latestRows, aggRows] = await Promise.all([
      this.prisma.$queryRaw<
        { peopleCount: number; densityScore: number }[]
      >`SELECT "peopleCount", "densityScore"
         FROM audience_events
         WHERE "siteId" = ${siteId}::uuid
         ORDER BY timestamp DESC
         LIMIT 1`,

      this.prisma.$queryRaw<
        { totalPeople: bigint; eventCount: bigint }[]
      >`SELECT COALESCE(SUM("peopleCount"), 0) AS "totalPeople",
                COUNT(*) AS "eventCount"
         FROM audience_events
         WHERE "siteId" = ${siteId}::uuid
           AND timestamp >= NOW() - INTERVAL '24 hours'`,
    ]);

    const latest = latestRows[0] ?? null;
    const agg = aggRows[0] ?? { totalPeople: 0n, eventCount: 0n };

    return {
      currentVisitors: latest?.peopleCount ?? 0,
      dailyVisitors: Number(agg.totalPeople),
      avgWaitTime: 0,
      activeCampaigns: 0,
      densityScore: latest?.densityScore ?? 0,
      eventCount: Number(agg.eventCount),
    };
  }

  async getEvents(siteId: string) {
    // Raw SQL to reliably query across TimescaleDB partitions
    return this.prisma.$queryRaw<
      {
        id: string;
        siteId: string;
        deviceId: string;
        timestamp: string;
        peopleCount: number;
        densityScore: number;
        youngCount: number;
        adultCount: number;
        seniorCount: number;
      }[]
    >`SELECT id, "siteId", "deviceId", timestamp, "peopleCount",
              "densityScore", "youngCount", "adultCount", "seniorCount"
       FROM audience_events
       WHERE "siteId" = ${siteId}::uuid
       ORDER BY timestamp DESC
       LIMIT 50`;
  }
}

