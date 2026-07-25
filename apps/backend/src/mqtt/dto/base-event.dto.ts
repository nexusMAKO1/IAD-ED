/**
 * base-event.dto.ts — Base MQTT Event DTO
 * Express Display SmartVision — T-021
 *
 * Every MQTT message published in the SmartVision ecosystem must conform
 * to this envelope structure. Services that deviate are rejected.
 */

import {
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class BaseEventDto {
  /** ISO-8601 UTC timestamp of the event */
  @IsDateString()
  timestamp!: string;

  /** Physical device identifier (e.g. camera hostname) */
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  /** Logical site identifier */
  @IsString()
  @IsOptional()
  siteId?: string | null;

  /** Discriminator for the event type */
  @IsString()
  @IsNotEmpty()
  event!: string;

  /** Arbitrary event-specific data */
  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;
}
