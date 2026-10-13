import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { StorageService } from '../common/storage/storage.service';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async uploadMedia(
    file: Express.Multer.File,
  ): Promise<{ url: string; filename: string; size: number }> {
    this.logger.log('Campaign upload received, delegating to StorageService');
    const result = await this.storageService.uploadFile(file, 'campaigns');
    return {
      url: result.url,
      filename: result.filename,
      size: result.size,
    };
  }

  async create(createCampaignDto: CreateCampaignDto) {
    this.logger.log('Saving campaign');
    const campaign = await this.prisma.campaign.create({
      data: createCampaignDto,
    });
    this.logger.log('Campaign created');
    this.logger.log('Returning response');
    return campaign;
  }

  async findAll() {
    return this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActive() {
    return this.prisma.campaign.findMany({
      where: { active: true },
      orderBy: { priority: 'asc' }, // Or however priority is sorted
    });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
    });
    if (!campaign) {
      throw new NotFoundException(`Campagne #${id} introuvable`);
    }
    return campaign;
  }

  async update(id: string, updateCampaignDto: UpdateCampaignDto) {
    try {
      return await this.prisma.campaign.update({
        where: { id },
        data: updateCampaignDto,
      });
    } catch (e) {
      throw new NotFoundException(`Campagne #${id} introuvable`);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.campaign.delete({
        where: { id },
      });
    } catch (e) {
      throw new NotFoundException(`Campagne #${id} introuvable`);
    }
  }
}
