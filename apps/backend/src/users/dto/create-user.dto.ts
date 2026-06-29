/**
 * create-user.dto.ts — Create User DTO
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'manager@expressdisplay.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Min 8 chars, at least one uppercase, one number, one symbol',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+$/,
    {
      message:
        'Password must contain at least one uppercase letter, one number, and one special character',
    },
  )
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.AGENT })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'UUID of the site to associate this user with',
  })
  @IsUUID('4')
  @IsOptional()
  siteId?: string;
}
