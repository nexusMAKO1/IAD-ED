/**
 * update-site.dto.ts — DTO pour la mise à jour d'un site
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateSiteDto {
  @ApiPropertyOptional({ example: 'Express Display Paris Centre' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '10 Rue de la Paix, 75002 Paris' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address?: string;
}
