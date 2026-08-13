import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  private minioClient: Minio.Client;
  private bucketName: string = 'campaigns';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const endPoint = this.configService.get<string>('MINIO_ENDPOINT', 'minio');
    const port = parseInt(
      this.configService.get<string>('MINIO_PORT', '9000'),
      10,
    );
    const accessKey =
      this.configService.get<string>('MINIO_ACCESS_KEY') ||
      this.configService.get<string>('MINIO_ROOT_USER', 'minioadmin');
    const secretKey =
      this.configService.get<string>('MINIO_SECRET_KEY') ||
      this.configService.get<string>('MINIO_ROOT_PASSWORD', 'minioadmin');
    this.bucketName = this.configService.get<string>(
      'MINIO_BUCKET',
      'campaigns',
    );

    this.minioClient = new Minio.Client({
      endPoint,
      port,
      useSSL: false,
      accessKey,
      secretKey,
    });

    this.initBucket();
  }

  private async initBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        // Set policy for public read access
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Action: ['s3:GetObject'],
              Effect: 'Allow',
              Principal: '*',
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.minioClient.setBucketPolicy(
          this.bucketName,
          JSON.stringify(policy),
        );
        this.logger.log(`Created MinIO bucket: ${this.bucketName}`);
      }
    } catch (err) {
      this.logger.error(`Error initializing MinIO bucket: ${err}`);
    }
  }

  async uploadMedia(
    file: Express.Multer.File,
  ): Promise<{ url: string; filename: string; size: number }> {
    try {
      this.logger.log('Campaign upload received');
      // Ensure bucket exists before attempting to upload
      await this.initBucket();

      const fileName = `${Date.now()}-${file.originalname}`;
      this.logger.log('Uploading to MinIO');
      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        file.buffer,
        file.size,
        { 'Content-Type': file.mimetype },
      );
      this.logger.log('MinIO upload successful');

      // Use the MINIO_PUBLIC_ENDPOINT or localhost for the public URL if it's accessed via browser
      const host = this.configService.get<string>(
        'MINIO_PUBLIC_ENDPOINT',
        'localhost',
      );
      const port = this.configService.get<string>('MINIO_PORT', '9000');

      return {
        url: `http://${host}:${port}/${this.bucketName}/${fileName}`,
        filename: fileName,
        size: file.size,
      };
    } catch (error) {
      this.logger.error(`Upload to MinIO failed: ${error}`);
      throw new InternalServerErrorException(
        `Upload to MinIO failed: ${error instanceof Error ? error.message : error}`,
      );
    }
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
