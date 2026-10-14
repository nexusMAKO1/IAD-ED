import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as fs from 'fs';

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Detect actual MIME type from buffer header bytes (magic numbers).
 */
export function detectMimeFromBuffer(header: Buffer): string | null {
  if (!header || header.length < 4) return null;

  // JPEG: FF D8 FF
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
  if (
    header.length >= 12 &&
    header.toString('ascii', 0, 4) === 'RIFF' &&
    header.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  // WebM: 1A 45 DF A3 (EBML)
  if (
    header.length >= 4 &&
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3
  ) {
    return 'video/webm';
  }

  // MP4 / QuickTime: 'ftyp' at bytes 4-7
  if (header.length >= 8 && header.toString('ascii', 4, 8) === 'ftyp') {
    if (header.length >= 12 && header.toString('ascii', 8, 12).startsWith('qt')) {
      return 'video/quicktime';
    }
    return 'video/mp4';
  }

  // QuickTime atoms: moov, wide, mdat at offset 4
  if (header.length >= 8) {
    const box = header.toString('ascii', 4, 8);
    if (['moov', 'wide', 'mdat'].includes(box)) {
      return 'video/quicktime';
    }
  }

  return null;
}

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
   * Validate file size and binary signature (magic numbers).
   */
  async validateFileContent(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('Fichier manquant ou invalide');
    }

    let fileSize = file.size;
    let headerBuffer: Buffer;

    if (file.path) {
      try {
        const stat = await fs.promises.stat(file.path);
        fileSize = stat.size;
        const handle = await fs.promises.open(file.path, 'r');
        try {
          headerBuffer = Buffer.alloc(64);
          const { bytesRead } = await handle.read(headerBuffer, 0, 64, 0);
          headerBuffer = headerBuffer.subarray(0, bytesRead);
        } finally {
          await handle.close();
        }
      } catch (err: any) {
        throw new BadRequestException(`Impossible de lire le fichier temporaire: ${err.message}`);
      }
    } else if (file.buffer) {
      fileSize = Math.max(file.size ?? 0, file.buffer.length);
      headerBuffer = file.buffer.subarray(0, 64);
    } else {
      throw new BadRequestException('Contenu de fichier inaccessible');
    }

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `Le fichier dépasse la taille maximale autorisée (50 Mo). Reçu: ${(fileSize / (1024 * 1024)).toFixed(1)} Mo`,
      );
    }

    const detectedMime = detectMimeFromBuffer(headerBuffer);
    if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
      throw new BadRequestException(
        `Signature de fichier invalide ou format non supporté. Types acceptés: MP4, WebM, QuickTime, JPEG, PNG, WebP. Détecté: ${detectedMime ?? 'inconnu'}`,
      );
    }

    return detectedMime;
  }

  /**
   * Upload a file to MinIO storage. Supports streaming from disk (`file.path`) or memory (`file.buffer`).
   * Guarantees cleanup of temporary files on disk upon completion or failure.
   */
  async uploadFile(
    file: Express.Multer.File,
    bucketName: string = this.defaultBucket,
  ): Promise<UploadResult> {
    let detectedMime: string;
    try {
      detectedMime = await this.validateFileContent(file);
    } catch (err) {
      if (file.path) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
      throw err;
    }

    await this.ensureBucket(bucketName);

    // Sanitize and create unique filename
    const originalName = file.originalname || 'media';
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}-${sanitizedName}`;

    try {
      let finalSize = file.size;

      if (file.path) {
        // Stream directly from disk without buffering entire file in memory
        const stat = await fs.promises.stat(file.path);
        finalSize = stat.size;
        await this.client.fPutObject(bucketName, filename, file.path, {
          'Content-Type': detectedMime,
        });
      } else if (file.buffer) {
        finalSize = file.buffer.length;
        await this.client.putObject(
          bucketName,
          filename,
          file.buffer,
          finalSize,
          { 'Content-Type': detectedMime },
        );
      }

      const url = this.buildPublicUrl(bucketName, filename);
      this.logger.log(`Fichier stocké dans MinIO: ${filename} (${finalSize} octets)`);

      return {
        url,
        filename,
        size: finalSize,
        mimeType: detectedMime,
      };
    } catch (err: any) {
      this.logger.error(`Erreur d'upload MinIO: ${err.message}`);
      throw new InternalServerErrorException("Échec de l'enregistrement du média");
    } finally {
      // Always clean up temporary file from disk if present
      if (file.path) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
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
