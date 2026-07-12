import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsDateString,
  IsObject,
} from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsString()
  mediaUrl: string;

  @IsString()
  @IsOptional()
  mediaType?: string;

  @IsInt()
  @IsOptional()
  duration?: number;

  @IsObject()
  targetAudience: Record<string, any>;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsDateString()
  @IsOptional()
  startDate?: string | Date;

  @IsDateString()
  @IsOptional()
  endDate?: string | Date;

  @IsObject()
  @IsOptional()
  activeHours?: Record<string, any>;

  @IsString()
  @IsOptional()
  targetAge?: string | null;

  @IsString()
  @IsOptional()
  targetGender?: string | null;

  @IsString()
  @IsOptional()
  targetEmotion?: string | null;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsInt()
  @IsOptional()
  playlistOrder?: number;
}
