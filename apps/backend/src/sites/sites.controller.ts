/**
 * sites.controller.ts — Sites Endpoints
 * IAD & SmartQueue AI — Express Display SmartVision (T-032 / F4.2 & F4.3)
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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SitesService } from './sites.service';
import { UpdateSiteThresholdsDto } from './dto/update-site-thresholds.dto';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@ApiTags('Sites')
@Controller('sites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  /**
   * POST /api/v1/sites
   * Crée un nouveau site — réservé aux rôles ADMIN.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer un nouveau site' })
  @ApiResponse({ status: 201, description: 'Site créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides (validation)' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  create(@Body() dto: CreateSiteDto) {
    return this.sitesService.create(dto);
  }

  /**
   * GET /api/v1/sites
   * Liste tous les sites — accessible à tous les rôles authentifiés.
   */
  @Get()
  @ApiOperation({ summary: 'Lister tous les sites' })
  @ApiResponse({ status: 200, description: 'Liste des sites retournée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  findAll() {
    return this.sitesService.findAll();
  }

  /**
   * GET /api/v1/sites/:id
   * Détail d'un site — accessible à tous les rôles authentifiés.
   */
  @Get(':id')
  @ApiOperation({ summary: "Obtenir le détail d'un site" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Site retourné' })
  @ApiResponse({ status: 404, description: 'Site introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sitesService.findOne(id);
  }

  /**
   * PATCH /api/v1/sites/:id
   * Met à jour le nom et l'adresse d'un site — réservé aux rôles ADMIN et MANAGER.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Mettre à jour les infos générales d\'un site' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Site mis à jour' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 404, description: 'Site introuvable' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.sitesService.update(id, dto);
  }

  /**
   * DELETE /api/v1/sites/:id
   * Supprime un site — retourne 409 si des Device sont encore rattachés.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un site' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Site supprimé avec succès' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Site introuvable' })
  @ApiResponse({ status: 409, description: 'Des devices sont encore rattachés au site' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.sitesService.remove(id);
  }

  /**
   * PATCH /api/v1/sites/:id/thresholds
   * Mise à jour des seuils (F4.3) — réservé aux rôles ADMIN et MANAGER.
   */
  @Patch(':id/thresholds')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary:
      "Mettre à jour les seuils de densité et d'anomalie de file d'un site",
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Seuils mis à jour avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides (validation)' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Site introuvable' })
  updateThresholds(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteThresholdsDto,
  ) {
    return this.sitesService.updateThresholds(id, dto);
  }
}
