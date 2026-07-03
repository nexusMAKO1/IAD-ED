/**
 * devices.service.ts — Devices Business Logic
 * IAD & SmartQueue AI — Express Display SmartVision (T-032 / F4.2)
 *
 * CRUD complet des dispositifs (écrans, totems, bornes).
 * Chaque dispositif est toujours rattaché à un site existant.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Device } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SitesService } from '../sites/sites.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sitesService: SitesService,
  ) {}

  /**
   * Crée un nouveau dispositif rattaché à un site existant.
   * Lève NotFoundException si le siteId est inconnu.
   */
  async create(dto: CreateDeviceDto): Promise<Device> {
    // Validate that the site exists (throws 404 if not)
    await this.sitesService.findOne(dto.siteId);

    try {
      const device = await this.prisma.device.create({
        data: {
          name: dto.name,
          type: dto.type,
          ipAddress: dto.ipAddress ?? null,
          siteId: dto.siteId,
        },
        include: { site: { select: { id: true, name: true } } },
      });

      this.logger.log(
        `Dispositif créé: ${device.name} (${device.id}) sur le site ${dto.siteId}`,
      );
      return device;
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException(`Le site référencé '${dto.siteId}' est invalide`);
      }
      this.logger.error(`Erreur lors de la création du dispositif: ${error.message}`, error.stack);
      throw new BadRequestException("Impossible de créer le dispositif");
    }
  }

  /**
   * Retourne tous les dispositifs d'un site, triés par nom.
   * Le siteId est obligatoire pour éviter de retourner tous les dispositifs.
   */
  async findBySite(siteId: string): Promise<Device[]> {
    // Validate that the site exists first
    await this.sitesService.findOne(siteId);

    try {
      return await this.prisma.device.findMany({
        where: { siteId },
        orderBy: { name: 'asc' },
      });
    } catch (error: any) {
      this.logger.error(`Erreur lors de la récupération des dispositifs: ${error.message}`, error.stack);
      throw new BadRequestException("Impossible de lister les dispositifs de ce site");
    }
  }

  /**
   * Retourne un dispositif par son UUID.
   * Lève NotFoundException si absent.
   */
  async findOne(id: string): Promise<Device> {
    try {
      const device = await this.prisma.device.findUnique({ where: { id } });
      if (!device) {
        throw new NotFoundException(`Dispositif avec l'id '${id}' introuvable`);
      }
      return device;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Erreur lors de la recherche du dispositif '${id}': ${error.message}`, error.stack);
      throw new NotFoundException(`Dispositif avec l'id '${id}' introuvable`);
    }
  }

  /**
   * Met à jour partiellement un dispositif (nom, IP, type, statut forcé).
   */
  async update(id: string, dto: UpdateDeviceDto): Promise<Device> {
    await this.findOne(id); // Assert existence

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Aucun champ à mettre à jour fourni');
    }

    try {
      const updated = await this.prisma.device.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.ipAddress !== undefined && { ipAddress: dto.ipAddress }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

      this.logger.log(`Dispositif mis à jour: ${updated.name} (${id})`);
      return updated;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Dispositif avec l'id '${id}' introuvable`);
      }
      this.logger.error(`Erreur lors de la mise à jour du dispositif: ${error.message}`, error.stack);
      throw new BadRequestException("Impossible de mettre à jour le dispositif");
    }
  }

  /**
   * Supprime un dispositif.
   * La suppression en cascade des AudienceEvents est gérée par Prisma (onDelete: Cascade).
   */
  async remove(id: string): Promise<void> {
    await this.findOne(id); // Assert existence

    try {
      await this.prisma.device.delete({ where: { id } });
      this.logger.log(`Dispositif supprimé: ${id}`);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Dispositif avec l'id '${id}' introuvable`);
      }
      this.logger.error(`Erreur lors de la suppression du dispositif: ${error.message}`, error.stack);
      throw new BadRequestException("Impossible de supprimer le dispositif");
    }
  }
}
