/**
 * update-site-thresholds.dto.ts — DTO de mise à jour des seuils d'un site
 * IAD & SmartQueue AI — Express Display SmartVision (T-032 / F4.3)
 *
 * Valide les seuils de densité et d'anomalie de file avant persistance.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min, Max, IsOptional } from 'class-validator';

export class UpdateSiteThresholdsDto {
  @ApiPropertyOptional({
    description:
      'Score de densité (personnes/zone) déclenchant un comportement adaptatif',
    example: 10,
    minimum: 0,
    maximum: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  densityThreshold?: number;

  @ApiPropertyOptional({
    description:
      "Seuil d'écart à la normale (en minutes) déclenchant l'alerte F2.9",
    example: 15,
    minimum: 0,
    maximum: 1440,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  anomalyQueueThreshold?: number;
}
