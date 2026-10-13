import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private readonly defaultBucket: string;

  constructor(private readonly configService: ConfigService) {
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
    this.defaultBucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'campaigns',
    );

    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL: false,
      accessKey,
      secretKey,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket(this.defaultBucket);
  }

  /**
   * Ensure a MinIO bucket exists and has public read policy configured.
   */
  async ensureBucket(bucketName: string = this.defaultBucket): Promise<void> {
    try {
      const exists = await this.client.bucketExists(bucketName);
      if (!exists) {
        await this.client.makeBucket(bucketName, 'us-east-1');
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Action: ['s3:GetObject'],
              Effect: 'Allow',
              Principal: '*',
              Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
          ],
        };
        await this.client.setBucketPolicy(bucketName, JSON.stringify(policy));
        this.logger.log(`Bucket MinIO '${bucketName}' créé avec succès`);
      }
    } catch (err: any) {
      this.logger.warn(`Initialisation MinIO '${bucketName}': ${err.message}`);
    }
  }

  /**
   * Validate file MIME type and size.
   */
  validateFile(file: Express.Multer.File): void {
    if (!file || !file.buffer) {
      throw new BadRequestException('Fichier manquant ou invalide');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Type MIME non supporté: ${file.mimetype}. Formats acceptés: MP4, WebM, JPEG, PNG, WebP`,
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `Le fichier dépasse la taille maximale autorisée (50 Mo). Reçu: ${(file.size / (1024 * 1024)).toFixed(1)} Mo`,
      );
    }
  }

  /**
   * Upload a file to MinIO storage.
   */
  async uploadFile(
    file: Express.Multer.File,
    bucketName: string = this.defaultBucket,
  ): Promise<UploadResult> {
    this.validateFile(file);
    await this.ensureBucket(bucketName);

    // Sanitize and create unique filename
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}-${sanitizedName}`;

    try {
      await this.client.putObject(
        bucketName,
        filename,
        file.buffer,
        file.size,
        { 'Content-Type': file.mimetype },
      );

      const url = this.buildPublicUrl(bucketName, filename);
      this.logger.log(`Fichier stocké dans MinIO: ${filename} (${file.size} octets)`);

      return {
        url,
        filename,
        size: file.size,
        mimeType: file.mimetype,
      };
    } catch (err: any) {
      this.logger.error(`Erreur d'upload MinIO: ${err.message}`);
      throw new InternalServerErrorException("Échec de l'enregistrement du média");
    }
  }

  /**
   * Delete a file from storage.
   */
  async deleteFile(
    filename: string,
    bucketName: string = this.defaultBucket,
  ): Promise<void> {
    try {
      await this.client.removeObject(bucketName, filename);
      this.logger.log(`Fichier supprimé de MinIO: ${filename}`);
    } catch (err: any) {
      this.logger.error(`Erreur de suppression MinIO '${filename}': ${err.message}`);
    }
  }

  /**
   * Construct the public access URL for a stored object.
   */
  buildPublicUrl(bucketName: string, filename: string): string {
    const host = this.configService.get<string>(
      'MINIO_PUBLIC_ENDPOINT',
      'localhost',
    );
    const port = this.configService.get<string>('MINIO_PORT', '9000');
    return `http://${host}:${port}/${bucketName}/${filename}`;
  }
}
