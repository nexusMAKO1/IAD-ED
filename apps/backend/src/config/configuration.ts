/**
 * configuration.ts — Application Configuration Factory
 * IAD & SmartQueue AI — Express Display SmartVision (T-012)
 *
 * Returns a typed configuration object loaded from environment variables.
 * Consumed by @nestjs/config's ConfigModule.
 */

export default () => ({
  port: parseInt(process.env.PORT ?? process.env.API_PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '3600s',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  mqtt: {
    url:
      process.env.MQTT_URL ??
      `mqtt://${process.env.MQTT_HOST ?? 'localhost'}:${process.env.MQTT_PORT ?? '1883'}`,
    host: process.env.MQTT_HOST ?? 'localhost',
    port: parseInt(process.env.MQTT_PORT ?? '1883', 10),
    wsPort: parseInt(process.env.MQTT_WS_PORT ?? '9001', 10),
    username: process.env.MQTT_USERNAME ?? process.env.MQTT_USER ?? '',
    password: process.env.MQTT_PASSWORD ?? '',
    clientId:
      process.env.MQTT_CLIENT_ID ??
      `backend-${process.env.HOSTNAME ?? 'local'}`,
    keepalive: parseInt(process.env.MQTT_KEEPALIVE ?? '60', 10),
    tls: process.env.MQTT_TLS === 'true',
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
  },
});
