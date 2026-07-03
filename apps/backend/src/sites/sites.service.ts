/**
 * sites.service.ts — Sites Business Logic
 * IAD & SmartQueue AI — Express Display SmartVision (T-032 / F4.2 & F4.3)
 *
 * Fournit la liste des sites (pour les dropdowns UI) et la mise à jour
 * des seuils de comportement adaptatif par site.
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Site } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSiteThresholdsDto } from './dto/update-site-thresholds.dto';

@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retourne tous les sites (utilisé par le sélecteur de site dans le Dashboard).
   */
  async findAll(): Promise<Site[]> {
    return this.prisma.site.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Retourne un site par son UUID.
   * Lève NotFoundException si absent.
   */
  async findOne(id: string): Promise<Site> {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) {
      throw new NotFoundException(`Site avec l'id '${id}' introuvable`);
    }
    return site;
  }

  /**
   * Met à jour uniquement les seuils de densité et d'anomalie d'un site (F4.3).
   */
  async updateThresholds(
    id: string,
    dto: UpdateSiteThresholdsDto,
  ): Promise<Site> {
    await this.findOne(id); // Assert existence, throws 404 if absent

    try {
      const updated = await this.prisma.site.update({
        where: { id },
        data: {
          ...(dto.densityThreshold !== undefined && { densityThreshold: dto.densityThreshold }),
          ...(dto.anomalyQueueThreshold !== undefined && { anomalyQueueThreshold: dto.anomalyQueueThreshold }),
        },
      });

      this.logger.log(
        `Seuils mis à jour pour le site ${id}: densité=${updated.densityThreshold}, anomalie=${updated.anomalyQueueThreshold}`,
      );

      return updated;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Site avec l'id '${id}' introuvable`);
      }
      this.logger.error(`Erreur de mise à jour des seuils du site: ${error.message}`, error.stack);
      throw new BadRequestException("Impossible de mettre à jour les seuils du site");
    }
  }
}
