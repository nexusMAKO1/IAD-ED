import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DetectionItemDto {
  @IsOptional()
  @IsNumber()
  track_id?: number;

  @IsNumber()
  confidence!: number;

  @IsOptional()
  @IsNumber()
  estimated_age?: number;

  @IsOptional()
  @IsString()
  age_group?: string;
}

export class DetectionsPayloadDto {
  @IsNumber()
  personCount!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetectionItemDto)
  detections!: DetectionItemDto[];
}
