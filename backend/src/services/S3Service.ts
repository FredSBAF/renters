import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import { config } from '../config/env';
import { logger } from '../utils/logger';

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

export class S3Service {
  private static buildS3Key(userId: number, mimeType: string): string {
    const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
    return `users/${userId}/documents/${uuidv4()}.${ext}`;
  }

  static async uploadFile(params: {
    buffer: Buffer;
    mimeType: string;
    userId: number;
    originalName: string;
  }): Promise<string> {
    const key = S3Service.buildS3Key(params.userId, params.mimeType);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.aws.s3Bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.mimeType,
        ServerSideEncryption: 'AES256',
      })
    );
    return key;
  }

  static async getPresignedUrl(fileKey: string, expiresInSeconds = 3600): Promise<string> {
    return getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: config.aws.s3Bucket, Key: fileKey }),
      { expiresIn: expiresInSeconds }
    );
  }

  static async getFileBuffer(fileKey: string): Promise<Buffer> {
    const res = await s3Client.send(
      new GetObjectCommand({ Bucket: config.aws.s3Bucket, Key: fileKey })
    );
    const body = res.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  static async deleteFile(fileKey: string): Promise<void> {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: config.aws.s3Bucket, Key: fileKey })
    );
    logger.info(`S3 file deleted: ${fileKey}`);
  }
}
