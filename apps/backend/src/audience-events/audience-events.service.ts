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
    this.mqttService.subscribe(
      MQTT_TOPICS.EDGE.DETECTIONS,
      async (topic, eventStr) => {
        await this.handleDetectionEvent(eventStr);
      },
    );
  }

  private async handleDetectionEvent(event: Record<string, any>) {
    try {
      const payload = event.payload;
      if (!payload) return;

      const dto = plainToInstance(DetectionsPayloadDto, payload);
      const errors = await validate(dto);
      if (errors.length > 0) {
        this.logger.warn(
          `[IAD MQTT] Rejected detection event — invalid payload structure (deviceId=${event.deviceId})`,
        );
        return;
      }

      const siteId = event.siteId;
      const deviceId = event.deviceId;

      if (!siteId) {
        this.logger.warn(
          `[IAD MQTT] Rejected detection event — device is UNPAIRED (deviceId=${deviceId})`,
        );
        return;
      }
      // Using new Date() instead of event.timestamp string as Prisma expects Date
      const timestamp = new Date(event.timestamp);

      let youngCount = 0;
      let adultCount = 0;
      let seniorCount = 0;
      let maleCount = 0;
      let femaleCount = 0;

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

        const gender = det.gender?.toLowerCase();
        if (gender === 'male') {
          maleCount++;
        } else if (gender === 'female') {
          femaleCount++;
        }
      }

      const peopleCount = dto.personCount;
      const densityScore = 0.0;
      const avgDwellTime = 0.0;

      this.logger.log(
        `[IAD MQTT] Received detection event — deviceId=${deviceId} siteId=${siteId} peopleCount=${peopleCount} young=${youngCount} adult=${adultCount} senior=${seniorCount}`,
      );

      await this.prisma.audienceEvent.create({
        data: {
          site: { connect: { id: siteId } },
          device: { connect: { deviceId } },
          timestamp,
          peopleCount,
          youngCount,
          adultCount,
          seniorCount,
          maleCount,
          femaleCount,
          densityScore,
          avgDwellTime,
        },
      });

      this.logger.log(
        `[IAD DB] AudienceEvent created — siteId=${siteId} deviceId=${deviceId} peopleCount=${peopleCount}`,
      );

      // Update Prometheus metrics
      this.iadMetrics.peopleDetectedTotal.inc(
        { siteId, deviceId },
        peopleCount,
      );
      this.iadMetrics.currentPeople.set({ siteId, deviceId }, peopleCount);
      if (youngCount > 0) {
        for (const det of dto.detections) {
          const group = det.age_group;
          if (group === 'child')
            this.iadMetrics.ageChild.inc({ siteId, deviceId });
          else if (group === 'teen')
            this.iadMetrics.ageTeen.inc({ siteId, deviceId });
          else if (group === 'young_adult')
            this.iadMetrics.ageYoungAdult.inc({ siteId, deviceId });
        }
      }
      if (adultCount > 0)
        this.iadMetrics.ageAdult.inc({ siteId, deviceId }, adultCount);
      if (seniorCount > 0)
        this.iadMetrics.ageSenior.inc({ siteId, deviceId }, seniorCount);

      this.logger.debug(
        `Ingested audience event for site ${siteId} (${peopleCount} people)`,
      );
    } catch (err: any) {
      this.logger.error(`[IAD MQTT] Error processing audience event: ${err.message}`, err.stack);
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
        {
          totalPeople: bigint;
          eventCount: bigint;
          totalYoung: bigint;
          totalAdult: bigint;
          totalSenior: bigint;
          totalMale: bigint;
          totalFemale: bigint;
        }[]
      >`SELECT COALESCE(SUM("peopleCount"), 0) AS "totalPeople",
                COUNT(*) AS "eventCount",
                COALESCE(SUM("youngCount"), 0) AS "totalYoung",
                COALESCE(SUM("adultCount"), 0) AS "totalAdult",
                COALESCE(SUM("seniorCount"), 0) AS "totalSenior",
                COALESCE(SUM("maleCount"), 0) AS "totalMale",
                COALESCE(SUM("femaleCount"), 0) AS "totalFemale"
         FROM audience_events
         WHERE "siteId" = ${siteId}::uuid
           AND timestamp >= NOW() - INTERVAL '24 hours'`,
    ]);

    const latest = latestRows[0] ?? null;
    const agg = aggRows[0] ?? {
      totalPeople: 0n,
      eventCount: 0n,
      totalYoung: 0n,
      totalAdult: 0n,
      totalSenior: 0n,
      totalMale: 0n,
      totalFemale: 0n,
    };

    const currentVisitors = latest?.peopleCount ?? 0;
    const rawDensity = latest?.densityScore ?? 0;

    // Derive a crowd density label from the most recent densityScore or peopleCount
    let crowdDensity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (currentVisitors >= 20 || rawDensity >= 0.8) crowdDensity = 'critical';
    else if (currentVisitors >= 10 || rawDensity >= 0.6) crowdDensity = 'high';
    else if (currentVisitors >= 5 || rawDensity >= 0.3) crowdDensity = 'medium';

    const totalMale = Number(agg.totalMale);
    const totalFemale = Number(agg.totalFemale);
    const genderTotal = totalMale + totalFemale;
    const malePercent = genderTotal > 0 ? Math.round((totalMale / genderTotal) * 100) : 50;
    const femalePercent = 100 - malePercent;

    // Split youngCount into childrenCount (30%) and part of adultsCount
    const totalYoung = Number(agg.totalYoung);
    const childrenCount = Math.floor(totalYoung * 0.3);
    const adultsCount = Number(agg.totalAdult) + (totalYoung - childrenCount);
    const seniorsCount = Number(agg.totalSenior);

    return {
      currentVisitors,
      dailyVisitors: Number(agg.totalPeople),
      avgWaitTime: 0,
      activeCampaigns: 0,
      densityScore: rawDensity,
      eventCount: Number(agg.eventCount),
      // IAD fields expected by the frontend AudienceStats interface
      crowdDensity,
      malePercent,
      femalePercent,
      childrenCount,
      adultsCount,
      seniorsCount,
      attentionRate: 0,
      avgQueueLength: 0,
    };
  }

  async getEvents(siteId: string) {
    // Raw SQL to reliably query across TimescaleDB partitions
    const rows = await this.prisma.$queryRaw<
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

    return rows.map(row => {
      let dominantAge = 'unknown';
      let maxCount = -1;
      if (row.youngCount > maxCount) { maxCount = row.youngCount; dominantAge = 'young_adult'; }
      if (row.adultCount > maxCount) { maxCount = row.adultCount; dominantAge = 'adult'; }
      if (row.seniorCount > maxCount) { maxCount = row.seniorCount; dominantAge = 'senior'; }
      
      // If all are zero but peopleCount > 0, fallback to adult
      if (maxCount === 0 && row.peopleCount > 0) {
        dominantAge = 'adult';
      }

      return {
        id: row.id,
        timestamp: row.timestamp,
        siteId: row.siteId,
        deviceId: row.deviceId,
        ageGroup: dominantAge,
        gender: 'unknown',
        confidence: 1.0,
        count: row.peopleCount
      };
    });
  }

  async getDemographics(siteId: string) {
    // Analytics for the last 7 days
    const aggRows = await this.prisma.$queryRaw<
      {
        totalPeople: bigint;
        totalYoung: bigint;
        totalAdult: bigint;
        totalSenior: bigint;
        totalMale: bigint;
        totalFemale: bigint;
      }[]
    >`SELECT COALESCE(SUM("peopleCount"), 0) AS "totalPeople",
             COALESCE(SUM("youngCount"), 0) AS "totalYoung",
             COALESCE(SUM("adultCount"), 0) AS "totalAdult",
             COALESCE(SUM("seniorCount"), 0) AS "totalSenior",
             COALESCE(SUM("maleCount"), 0) AS "totalMale",
             COALESCE(SUM("femaleCount"), 0) AS "totalFemale"
      FROM audience_events
      WHERE "siteId" = ${siteId}::uuid
        AND timestamp >= NOW() - INTERVAL '7 days'`;

    const peakHoursRows = await this.prisma.$queryRaw<
      { hour: number; count: bigint }[]
    >`SELECT EXTRACT(HOUR FROM timestamp)::int AS "hour",
             SUM("peopleCount") AS "count"
      FROM audience_events
      WHERE "siteId" = ${siteId}::uuid
        AND timestamp >= NOW() - INTERVAL '7 days'
      GROUP BY "hour"
      ORDER BY "count" DESC
      LIMIT 3`;

    const agg = aggRows[0] ?? {
      totalPeople: 0n,
      totalYoung: 0n,
      totalAdult: 0n,
      totalSenior: 0n,
      totalMale: 0n,
      totalFemale: 0n,
    };
    const total = Number(agg.totalPeople);

    const male = Number(agg.totalMale);
    const female = Number(agg.totalFemale);

    // We split young into child and young_adult for the expected payload
    const totalYoung = Number(agg.totalYoung);
    const child = Math.floor(totalYoung * 0.3);
    const young_adult = totalYoung - child;

    return {
      ageGroups: {
        child,
        young_adult,
        adult: Number(agg.totalAdult),
        senior: Number(agg.totalSenior),
      },
      gender: {
        male,
        female,
      },
      peakHours: peakHoursRows.map((row) => ({
        hour: row.hour,
        count: Number(row.count),
      })),
      totalVisitors: total,
    };
  }

  async getTimeseries(siteId: string, granularity: 'minute' | 'hour' | 'day') {
    // Validate granularity to prevent SQL injection
    if (!['minute', 'hour', 'day'].includes(granularity)) {
      granularity = 'hour';
    }

    // Dynamic interval based on granularity
    let interval = '24 hours';
    if (granularity === 'minute') interval = '1 hour';
    else if (granularity === 'day') interval = '30 days';

    const rows = await this.prisma.$queryRawUnsafe<
      { timestamp: Date; visitors: bigint }[]
    >(
      `
      SELECT DATE_TRUNC($1, timestamp) AS timestamp,
             COALESCE(SUM("peopleCount"), 0) AS visitors
      FROM audience_events
      WHERE "siteId" = $2::uuid
        AND timestamp >= NOW() - $3::interval
      GROUP BY DATE_TRUNC($1, timestamp)
      ORDER BY timestamp ASC
    `,
      granularity,
      siteId,
      interval,
    );

    return rows.map((row) => ({
      timestamp: row.timestamp.toISOString(),
      visitors: Number(row.visitors),
    }));
  }
}
