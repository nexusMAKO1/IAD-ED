/**
 * create-site.dto.ts — DTO de création d'un site
 * IAD & SmartQueue AI — Express Display SmartVision
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OperatingHoursDto {
  @ApiProperty({
    description: "Heure d'ouverture (HH:mm)",
    example: '08:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: "L'heure d'ouverture doit être au format HH:mm" })
  open: string;

  @ApiProperty({
    description: 'Heure de fermeture (HH:mm)',
    example: '22:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: "L'heure de fermeture doit être au format HH:mm" })
  close: string;
}

export class CreateSiteDto {
  @ApiProperty({
    description: 'Nom du site',
    example: 'Centre Commercial Paris Maillot',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Adresse postale',
    example: '2 Place de la Porte Maillot, 75017 Paris',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @ApiPropertyOptional({
    description: 'Fuseau horaire IANA',
    example: 'Europe/Paris',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @ApiPropertyOptional({
    description: "Plages horaires d'exploitation",
    type: OperatingHoursDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  operatingHours?: OperatingHoursDto;
}
