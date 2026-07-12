/**
 * update-device.dto.ts — DTO de mise à jour partielle d'un dispositif
 * IAD & SmartQueue AI — Express Display SmartVision (T-032 / F4.2)
 *
 * Tous les champs de CreateDeviceDto sont optionnels + ajout du statut forcé.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceStatus, DeviceType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';

export class UpdateDeviceDto {
  @ApiPropertyOptional({
    description: "Nouveau nom lisible de l'écran",
    example: 'Totem hall B',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Type de dispositif',
    enum: DeviceType,
  })
  @IsOptional()
  @IsEnum(DeviceType)
  type?: DeviceType;

  @ApiPropertyOptional({
    description: 'Adresse IP mise à jour',
    example: '10.0.0.5',
  })
  @IsOptional()
  @IsString()
  @Matches(/^((\d{1,3}\.){3}\d{1,3}|([a-fA-F0-9:]+))$/, {
    message: "Format d'adresse IP invalide (IPv4 ou IPv6)",
  })
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'Forcer manuellement le statut du dispositif',
    enum: DeviceStatus,
  })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firmwareVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mqttClientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  siteId?: string;
}
