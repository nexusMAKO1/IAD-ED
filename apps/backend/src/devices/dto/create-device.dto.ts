/**
 * create-device.dto.ts — DTO de création d'un dispositif
 * IAD & SmartQueue AI — Express Display SmartVision (T-032 / F4.2)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({
    description: "Nom lisible de l'écran ou du dispositif",
    example: 'Totem entrée principale',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Type de dispositif',
    enum: DeviceType,
    example: DeviceType.TOTEM,
  })
  @IsEnum(DeviceType)
  type!: DeviceType;

  @ApiPropertyOptional({
    description: 'Adresse IP du dispositif (optionnelle)',
    example: '192.168.1.42',
  })
  @IsOptional()
  @IsString()
  @Matches(/^((\d{1,3}\.){3}\d{1,3}|([a-fA-F0-9:]+))$/, {
    message: "Format d'adresse IP invalide (IPv4 ou IPv6)",
  })
  ipAddress?: string;

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

  @ApiProperty({
    description: 'UUID du site auquel ce dispositif appartient',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  siteId!: string;
}
