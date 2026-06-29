/**
 * refresh-token.dto.ts — Refresh Token DTO
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Valid refresh token obtained from /auth/login',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  @IsJWT({ message: 'refreshToken must be a valid JWT string' })
  refreshToken: string;
}
