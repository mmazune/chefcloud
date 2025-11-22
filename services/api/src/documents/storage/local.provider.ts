/**
 * M18: Local Filesystem Storage Provider
 * Stores documents on local disk at /data/documents
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { IStorageProvider, UploadResult } from './storage.interface';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath = '/data/documents';

  async upload(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    orgId: string,
  ): Promise<UploadResult> {
    // Generate checksum
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // Generate unique storage key: orgId/YYYY-MM/checksum-originalname
    const date = new Date();
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${orgId}/${yearMonth}/${checksum.substring(0, 16)}-${safeName}`;

    // Ensure directory exists
    const fullPath = path.join(this.basePath, storageKey);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, buffer);

    this.logger.log(`Uploaded document: ${storageKey}`);

    return { storageKey, checksum };
  }

  async download(storageKey: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, storageKey);
    return fs.readFile(fullPath);
  }

  async delete(storageKey: string): Promise<void> {
    const fullPath = path.join(this.basePath, storageKey);
    await fs.unlink(fullPath);
    this.logger.log(`Deleted document: ${storageKey}`);
  }
}
