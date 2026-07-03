/**
 * devices.controller.ts — Devices Endpoints
 * IAD & SmartQueue AI — Express Display SmartVision (T-032 / F4.2)
 *
 * Expose le CRUD complet des dispositifs avec protection JWT + RBAC.
 * - GET   /api/devices?siteId=xxx  → tous les rôles authentifiés
 * - POST  /api/devices             → ADMIN, MANAGER
 * - PATCH /api/devices/:id         → ADMIN, MANAGER
 * - DELETE /api/devices/:id        → ADMIN, MANAGER
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@ApiTags('Devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /**
   * POST /api/devices
   * Crée un nouveau dispositif — réservé à ADMIN et MANAGER.
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Créer un nouveau dispositif' })
  @ApiResponse({ status: 201, description: 'Dispositif créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Site introuvable' })
  create(@Body() createDeviceDto: CreateDeviceDto) {
    return this.devicesService.create(createDeviceDto);
  }

  /**
   * GET /api/devices?siteId=xxx
   * Liste les dispositifs d'un site — accessible à tous les rôles authentifiés.
   */
  @Get()
  @ApiOperation({ summary: "Lister les dispositifs d'un site" })
  @ApiQuery({
    name: 'siteId',
    required: true,
    type: 'string',
    description: 'UUID du site',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des dispositifs retournée',
  })
  @ApiResponse({ status: 404, description: 'Site introuvable' })
  findBySite(@Query('siteId', ParseUUIDPipe) siteId: string) {
    return this.devicesService.findBySite(siteId);
  }

  /**
   * PATCH /api/devices/:id
   * Mise à jour partielle — réservé à ADMIN et MANAGER.
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Mettre à jour un dispositif' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Dispositif mis à jour' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Dispositif introuvable' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDeviceDto: UpdateDeviceDto,
  ) {
    return this.devicesService.update(id, updateDeviceDto);
  }

  /**
   * DELETE /api/devices/:id
   * Suppression d'un dispositif — réservé à ADMIN et MANAGER.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Supprimer un dispositif' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Dispositif supprimé' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Dispositif introuvable' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.devicesService.remove(id);
  }
}
