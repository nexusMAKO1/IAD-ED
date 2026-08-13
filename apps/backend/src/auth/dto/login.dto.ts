/**
 * login.dto.ts — Login Request DTO
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@expressdisplay.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'AdminSecurePassword123!',
    description: 'User password (min 8 characters)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password: string;
}
