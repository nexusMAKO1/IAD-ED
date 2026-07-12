/**
 * users.service.ts — Users Business Logic
 * IAD & SmartQueue AI — Express Display SmartVision (T-013)
 *
 * Provides CRUD operations for the User entity. Passwords are hashed
 * with bcrypt (salt rounds = 12) before persistence.
 */

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by their email address.
   * Returns null when not found (used by auth layer to distinguish existence).
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Find a user by their UUID.
   * Throws NotFoundException when not found.
   */
  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id '${id}' not found`);
    }
    return user;
  }

  /**
   * Create a new user with a bcrypt-hashed password.
   * Throws ConflictException if the email is already registered.
   */
  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(`Email '${dto.email}' is already registered`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
        siteId: dto.siteId ?? null,
      },
    });

    this.logger.log(`Created user: ${user.email} (${user.id})`);
    return user;
  }

  /**
   * Update selected fields on an existing user.
   * If password is provided it will be re-hashed.
   */
  async update(
    id: string,
    data: Partial<{ name: string; email: string; password: string; siteId: string }>,
  ): Promise<User> {
    await this.findById(id); // Assert existence

    const updateData: Partial<{
      name: string;
      email: string;
      password: string;
      siteId: string;
    }> = { ...data };

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    return this.prisma.user.update({ where: { id }, data: updateData });
  }
}
