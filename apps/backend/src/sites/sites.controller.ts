/**
 * sites.controller.ts — Sites Endpoints
 * IAD & SmartQueue AI — Express Display SmartVision (T-032 / F4.2 & F4.3)
 *
 * Expose la liste des sites et la mise à jour des seuils.
 * Le PATCH est réservé aux rôles ADMIN et MANAGER.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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

@ApiTags('Sites')
@Controller('sites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  /**
   * GET /api/sites
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
   * GET /api/sites/:id
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
   * PATCH /api/sites/:id/thresholds
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
