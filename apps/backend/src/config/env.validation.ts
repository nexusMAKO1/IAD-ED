/**
 * env.validation.ts — Environment Variable Validation Schema
 * IAD & SmartQueue AI — Express Display SmartVision (T-012)
 *
 * Uses Joi to validate required environment variables at startup.
 * The application will refuse to boot if required variables are missing
 * or fail their type/range constraints.
 */

import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),

  PORT: Joi.number().default(3000),
  API_PORT: Joi.number().default(3000), // Legacy alias used in .env

  // Database
  DATABASE_URL: Joi.string().uri().required(),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).optional(),
  JWT_EXPIRES_IN: Joi.string().default('3600s'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // MQTT (url-form or host/port form — at least one accepted)
  MQTT_URL: Joi.string().optional(),
  MQTT_HOST: Joi.string().optional(),
  MQTT_PORT: Joi.number().default(1883),
  MQTT_WS_PORT: Joi.number().default(9001),
  MQTT_USERNAME: Joi.string().optional().allow(''),
  MQTT_USER: Joi.string().optional().allow(''), // Legacy alias
  MQTT_PASSWORD: Joi.string().optional().allow(''),
  MQTT_CLIENT_ID: Joi.string().optional(),
  MQTT_KEEPALIVE: Joi.number().default(60),
  MQTT_TLS: Joi.string().valid('true', 'false').default('false'),

  // CORS
  CORS_ORIGIN: Joi.string().optional().default('*'),
}).options({ allowUnknown: true }); // Allow extra vars (POSTGRES_*, REDIS_*, etc.)
