/**
 * users.module.ts — Users Module
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 */

import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
