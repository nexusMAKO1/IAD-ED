import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  StorageService,
  detectMimeFromBuffer,
  MAX_FILE_SIZE_BYTES,
} from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  let mockMinioClient: any;

  beforeEach(async () => {
    mockMinioClient = {
      bucketExists: jest.fn().mockResolvedValue(true),
      makeBucket: jest.fn().mockResolvedValue(undefined),
      setBucketPolicy: jest.fn().mockResolvedValue(undefined),
      putObject: jest.fn().mockResolvedValue({ etag: '123' }),
      fPutObject: jest.fn().mockResolvedValue({ etag: '456' }),
      removeObject: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'MINIO_ENDPOINT') return 'localhost';
              if (key === 'MINIO_PORT') return '9000';
              if (key === 'MINIO_BUCKET') return 'campaigns';
              if (key === 'MINIO_PUBLIC_ENDPOINT') return 'localhost';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    // Replace internal MinIO client with our mock
    (service as any).client = mockMinioClient;
  });

  describe('detectMimeFromBuffer (Magic Numbers)', () => {
    it('detects JPEG from magic bytes FF D8 FF', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(detectMimeFromBuffer(buffer)).toBe('image/jpeg');
    });

    it('detects PNG from magic bytes 89 50 4E 47 0D 0A 1A 0A', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      expect(detectMimeFromBuffer(buffer)).toBe('image/png');
    });

    it('detects WebP from RIFF and WEBP signature', () => {
      const buffer = Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from('WEBP'),
      ]);
      expect(detectMimeFromBuffer(buffer)).toBe('image/webp');
    });

    it('detects WebM from EBML header 1A 45 DF A3', () => {
      const buffer = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42]);
      expect(detectMimeFromBuffer(buffer)).toBe('video/webm');
    });

    it('detects MP4 from ftyp box', () => {
      const buffer = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x18]),
        Buffer.from('ftypisom'),
      ]);
      expect(detectMimeFromBuffer(buffer)).toBe('video/mp4');
    });

    it('detects QuickTime when ftyp starts with qt', () => {
      const buffer = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x14]),
        Buffer.from('ftypqt  '),
      ]);
      expect(detectMimeFromBuffer(buffer)).toBe('video/quicktime');
    });

    it('rejects text, shell scripts, or spoofed PHP files', () => {
      const textBuffer = Buffer.from('<?php echo "exploit"; ?>');
      expect(detectMimeFromBuffer(textBuffer)).toBeNull();
      const shellBuffer = Buffer.from('#!/bin/bash\nrm -rf /');
      expect(detectMimeFromBuffer(shellBuffer)).toBeNull();
      const emptyBuffer = Buffer.alloc(0);
      expect(detectMimeFromBuffer(emptyBuffer)).toBeNull();
    });
  });

  describe('validateFileContent', () => {
    it('accepts valid JPEG buffer', async () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10]);
      const file = {
        buffer: validJpeg,
        size: validJpeg.length,
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
      } as Express.Multer.File;

      const detected = await service.validateFileContent(file);
      expect(detected).toBe('image/jpeg');
    });

    it('rejects MIME spoofing (client says image/png but content is plain text)', async () => {
      const fakePng = Buffer.from('GIF89a spoofed image pretending to be something else');
      const file = {
        buffer: fakePng,
        size: fakePng.length,
        mimetype: 'image/png',
        originalname: 'fake.png',
      } as Express.Multer.File;

      await expect(service.validateFileContent(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects oversized files exceeding MAX_FILE_SIZE_BYTES (50MB)', async () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);
      const file = {
        buffer: validJpeg,
        size: MAX_FILE_SIZE_BYTES + 1024,
        mimetype: 'image/jpeg',
        originalname: 'huge.jpg',
      } as Express.Multer.File;

      await expect(service.validateFileContent(file)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('uploadFile & Cleanup', () => {
    it('uploads in-memory buffer via putObject', async () => {
      const validPng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
      ]);
      const file = {
        buffer: validPng,
        size: validPng.length,
        mimetype: 'image/png',
        originalname: 'badge.png',
      } as Express.Multer.File;

      const result = await service.uploadFile(file);
      expect(result.mimeType).toBe('image/png');
      expect(result.url).toContain('campaigns');
      expect(mockMinioClient.putObject).toHaveBeenCalledTimes(1);
    });

    it('streams from disk via fPutObject and deletes temporary file after upload', async () => {
      const tmpPath = path.join(os.tmpdir(), `test-upload-${Date.now()}.png`);
      const validPng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x11, 0x22,
      ]);
      await fs.promises.writeFile(tmpPath, validPng);

      const file = {
        path: tmpPath,
        size: validPng.length,
        mimetype: 'image/png',
        originalname: 'temp.png',
      } as Express.Multer.File;

      const result = await service.uploadFile(file);
      expect(result.mimeType).toBe('image/png');
      expect(mockMinioClient.fPutObject).toHaveBeenCalledWith(
        'campaigns',
        expect.any(String),
        tmpPath,
        { 'Content-Type': 'image/png' },
      );

      // Verify file was unlinked and cleaned up
      const exists = fs.existsSync(tmpPath);
      expect(exists).toBe(false);
    });

    it('guarantees temporary file cleanup when MinIO upload fails', async () => {
      mockMinioClient.fPutObject.mockRejectedValueOnce(new Error('MinIO connection refused'));

      const tmpPath = path.join(os.tmpdir(), `test-fail-${Date.now()}.jpg`);
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
      await fs.promises.writeFile(tmpPath, validJpeg);

      const file = {
        path: tmpPath,
        size: validJpeg.length,
        mimetype: 'image/jpeg',
        originalname: 'fail.jpg',
      } as Express.Multer.File;

      await expect(service.uploadFile(file)).rejects.toThrow(
        InternalServerErrorException,
      );

      // Verify file was unlinked even on failure
      const exists = fs.existsSync(tmpPath);
      expect(exists).toBe(false);
    });

    it('cleans up disk file when validation fails on spoofed MIME', async () => {
      const tmpPath = path.join(os.tmpdir(), `test-spoof-${Date.now()}.jpg`);
      await fs.promises.writeFile(tmpPath, Buffer.from('malicious payload disguised'));

      const file = {
        path: tmpPath,
        size: 30,
        mimetype: 'image/jpeg',
        originalname: 'evil.jpg',
      } as Express.Multer.File;

      await expect(service.uploadFile(file)).rejects.toThrow(
        BadRequestException,
      );

      // Verify file was cleaned up on validation error
      const exists = fs.existsSync(tmpPath);
      expect(exists).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('calls removeObject on MinIO client', async () => {
      await service.deleteFile('media-123.mp4');
      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'campaigns',
        'media-123.mp4',
      );
    });
  });
});
