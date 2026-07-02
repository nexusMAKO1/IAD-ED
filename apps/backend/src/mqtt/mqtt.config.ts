/**
 * mqtt.config.ts — MQTT Connection Configuration
 * Express Display SmartVision — T-021
 *
 * Reads all broker settings exclusively from environment variables via ConfigService.
 * Never hardcodes credentials.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MqttConnectionConfig {
  host: string;
  port: number;
  wsPort: number;
  username: string;
  password: string;
  clientId: string;
  keepalive: number;
  tls: boolean;
  /** Full broker URL e.g. mqtt://mosquitto:1883 */
  brokerUrl: string;
}

@Injectable()
export class MqttConfigService {
  constructor(private readonly configService: ConfigService) {}

  get config(): MqttConnectionConfig {
    const host =
      this.configService.get<string>('mqtt.host') ??
      this.configService.get<string>('MQTT_HOST') ??
      'localhost';

    const port =
      this.configService.get<number>('mqtt.port') ??
      this.configService.get<number>('MQTT_PORT') ??
      1883;

    const wsPort =
      this.configService.get<number>('mqtt.wsPort') ??
      this.configService.get<number>('MQTT_WS_PORT') ??
      9001;

    const username =
      this.configService.get<string>('mqtt.username') ??
      this.configService.get<string>('MQTT_USERNAME') ??
      this.configService.get<string>('MQTT_USER') ??
      '';

    const password =
      this.configService.get<string>('mqtt.password') ??
      this.configService.get<string>('MQTT_PASSWORD') ??
      '';

    const clientId =
      this.configService.get<string>('mqtt.clientId') ??
      this.configService.get<string>('MQTT_CLIENT_ID') ??
      `backend-${process.env.HOSTNAME ?? 'local'}-${Date.now()}`;

    const keepalive =
      this.configService.get<number>('mqtt.keepalive') ??
      this.configService.get<number>('MQTT_KEEPALIVE') ??
      60;

    const tls =
      this.configService.get<string>('mqtt.tls') === 'true' ||
      this.configService.get<string>('MQTT_TLS') === 'true';

    const configuredUrl = this.configService.get<string>('mqtt.url');
    const brokerUrl =
      configuredUrl ?? `${tls ? 'mqtts' : 'mqtt'}://${host}:${port}`;

    return { host, port, wsPort, username, password, clientId, keepalive, tls, brokerUrl };
  }
}
