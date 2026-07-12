import { Injectable, OnModuleInit, forwardRef, Inject } from '@nestjs/common';
import { Counter, Gauge } from 'prom-client';
import { MqttService } from '../../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../../mqtt/mqtt.topics';

@Injectable()
export class IadMetricsService implements OnModuleInit {
  constructor(
    @Inject(forwardRef(() => MqttService))
    private readonly mqttService: MqttService,
  ) {}

  public peopleDetectedTotal = new Counter({
    name: 'iad_people_detected_total',
    help: 'Total number of people detected',
    labelNames: ['siteId', 'deviceId'],
  });

  public currentPeople = new Gauge({
    name: 'iad_current_people',
    help: 'Current people detected in the last frame',
    labelNames: ['siteId', 'deviceId'],
  });

  public ageChild = new Counter({
    name: 'iad_age_child',
    help: 'Total children detected',
    labelNames: ['siteId', 'deviceId'],
  });

  public ageTeen = new Counter({
    name: 'iad_age_teen',
    help: 'Total teens detected',
    labelNames: ['siteId', 'deviceId'],
  });

  public ageYoungAdult = new Counter({
    name: 'iad_age_young_adult',
    help: 'Total young adults detected',
    labelNames: ['siteId', 'deviceId'],
  });

  public ageAdult = new Counter({
    name: 'iad_age_adult',
    help: 'Total adults detected',
    labelNames: ['siteId', 'deviceId'],
  });

  public ageSenior = new Counter({
    name: 'iad_age_senior',
    help: 'Total seniors detected',
    labelNames: ['siteId', 'deviceId'],
  });

  public cameraFps = new Gauge({
    name: 'iad_camera_fps',
    help: 'Current detection FPS from Edge CV',
    labelNames: ['siteId', 'deviceId'],
  });

  public processingLatency = new Gauge({
    name: 'iad_processing_latency',
    help: 'Current processing latency from Edge CV in ms',
    labelNames: ['siteId', 'deviceId'],
  });

  public mqttMessagesTotal = new Counter({
    name: 'iad_mqtt_messages_total',
    help: 'Total MQTT messages received',
    labelNames: ['topic'],
  });

  public campaignSwitchesTotal = new Counter({
    name: 'iad_campaign_switches_total',
    help: 'Total campaign switches triggered',
    labelNames: ['siteId', 'deviceId', 'campaignId'],
  });

  public displayOnline = new Gauge({
    name: 'iad_display_online',
    help: 'Display online status (1 = online, 0 = offline)',
    labelNames: ['siteId', 'deviceId'],
  });

  public edgeHealth = new Gauge({
    name: 'iad_edge_health',
    help: 'Edge CV health status (1 = healthy, 0 = offline)',
    labelNames: ['siteId', 'deviceId'],
  });

  public backendHealth = new Gauge({
    name: 'iad_backend_health',
    help: 'Backend health status (1 = healthy, 0 = offline)',
    labelNames: ['service'],
  });

  public backendRequestsTotal = new Counter({
    name: 'iad_backend_requests_total',
    help: 'Total backend requests',
    labelNames: ['method', 'path'],
  });

  onModuleInit() {
    this.backendHealth.set({ service: 'backend' }, 1);

    // Subscribe to wildcard to count all messages
    this.mqttService.subscribe('#', (topic) => {
      this.mqttMessagesTotal.inc({ topic });
    });

    // Subscribe to performance telemetry
    this.mqttService.subscribe(
      MQTT_TOPICS.EDGE.PERFORMANCE,
      (topic, eventStr) => {
        const payload = eventStr.payload as any;
        if (payload) {
          if (payload.fps !== undefined)
            this.cameraFps.set(
              {
                siteId: eventStr.siteId as string,
                deviceId: eventStr.deviceId as string,
              },
              payload.fps,
            );
          if (payload.latencyMs !== undefined)
            this.processingLatency.set(
              {
                siteId: eventStr.siteId as string,
                deviceId: eventStr.deviceId as string,
              },
              payload.latencyMs,
            );
        }
      },
    );

    // Subscribe to health telemetry
    this.mqttService.subscribe(MQTT_TOPICS.SYSTEM.HEALTH, (topic, eventStr) => {
      const payload = eventStr.payload as any;
      if (payload && payload.serviceName === 'edge-cv') {
        const isHealthy =
          payload.status === 'healthy' || payload.status === 'online' ? 1 : 0;
        this.edgeHealth.set(
          {
            siteId: eventStr.siteId as string,
            deviceId: eventStr.deviceId as string,
          },
          isHealthy,
        );
      }
    });

    // Subscribe to display status
    this.mqttService.subscribe(
      MQTT_TOPICS.DISPLAY.STATUS,
      (topic, eventStr) => {
        const payload = eventStr.payload as any;
        if (payload) {
          const isOnline = payload.status === 'online' ? 1 : 0;
          this.displayOnline.set(
            {
              siteId: eventStr.siteId as string,
              deviceId: eventStr.deviceId as string,
            },
            isOnline,
          );
        }
      },
    );

    // Subscribe to campaigns
    this.mqttService.subscribe(
      MQTT_TOPICS.BACKEND.CAMPAIGNS,
      (topic, eventStr) => {
        const payload = eventStr.payload as any;
        if (payload && payload.campaignId) {
          this.campaignSwitchesTotal.inc({
            siteId: eventStr.siteId as string,
            deviceId: eventStr.deviceId as string,
            campaignId: payload.campaignId,
          });
        }
      },
    );
  }
}
