/**
 * sites.service.ts — Sites Business Logic
 * IAD & SmartQueue AI — Express Display SmartVision (T-032 / F4.2 & F4.3)
 *
 * Fournit la liste des sites (pour les dropdowns UI) et la mise à jour
 * des seuils de comportement adaptatif par site.
 */

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Site } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSiteThresholdsDto } from './dto/update-site-thresholds.dto';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un nouveau site en base de données.
   */
  async create(dto: CreateSiteDto): Promise<Site> {
    const site = await this.prisma.site.create({
      data: {
        name: dto.name,
        address: dto.address,
        // Store timezone & operatingHours as-is; schema uses plain columns + no JSON col for these
        // We cast to any to allow extra fields that may not be in the Prisma model yet
        ...(dto.timezone ? ({ timezone: dto.timezone } as any) : {}),
        ...(dto.operatingHours
          ? { operatingHours: dto.operatingHours as any }
          : {}),
      },
    });
    this.logger.log(`Site créé: ${site.name} (${site.id})`);
    return site;
  }

  /**
   * Supprime un site par son UUID.
   * Retourne 409 Conflict si des Device sont encore rattachés.
   */
  async remove(id: string): Promise<void> {
    await this.findOne(id); // throws 404 if not found

    // Check for existing devices — refuse deletion if any exist
    const deviceCount = await this.prisma.device.count({ where: { siteId: id } });
    if (deviceCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer le site: ${deviceCount} appareil(s) sont encore rattachés. Supprimez-les d'abord.`,
      );
    }

    try {
      await this.prisma.site.delete({ where: { id } });
      this.logger.log(`Site supprimé: ${id}`);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Site avec l'id '${id}' introuvable`);
      }
      this.logger.error(`Erreur de suppression du site: ${error.message}`, error.stack);
      throw new BadRequestException('Impossible de supprimer ce site');
    }
  }

  /**
   * Met à jour le nom et l'adresse d'un site.
   */
  async update(id: string, dto: UpdateSiteDto): Promise<Site> {
    await this.findOne(id);
    try {
      const updated = await this.prisma.site.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.address !== undefined && { address: dto.address }),
        },
      });
      this.logger.log(`Site mis à jour: ${updated.name} (${id})`);
      return updated;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Site avec l'id '${id}' introuvable`);
      }
      throw new BadRequestException('Impossible de mettre à jour ce site');
    }
  }

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
          ...(dto.densityThreshold !== undefined && {
            densityThreshold: dto.densityThreshold,
          }),
          ...(dto.anomalyQueueThreshold !== undefined && {
            anomalyQueueThreshold: dto.anomalyQueueThreshold,
          }),
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
      this.logger.error(
        `Erreur de mise à jour des seuils du site: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        'Impossible de mettre à jour les seuils du site',
      );
    }
  }
}
