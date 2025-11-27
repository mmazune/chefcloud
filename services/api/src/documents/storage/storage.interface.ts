/**
 * M18: Document Storage Abstraction Interface
 * Supports LOCAL, S3, GCS providers
 */

export interface UploadResult {
  storageKey: string;
  checksum?: string;
}

export interface IStorageProvider {
  /**
   * Upload a file to storage
   * @param buffer File buffer
   * @param fileName Original filename
   * @param mimeType File MIME type
   * @param orgId Organization ID for path isolation
   * @returns Storage key and checksum
   */
  upload(buffer: Buffer, fileName: string, mimeType: string, orgId: string): Promise<UploadResult>;

  /**
   * Download a file from storage
   * @param storageKey Storage key
   * @returns File buffer
   */
  download(storageKey: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   * @param storageKey Storage key
   */
  delete(storageKey: string): Promise<void>;

  /**
   * Get a signed URL for direct browser download (optional, for S3/GCS)
   * @param storageKey Storage key
   * @param expiresIn Expiry in seconds
   * @returns Signed URL or null if not supported
   */
  getSignedUrl?(storageKey: string, expiresIn: number): Promise<string | null>;
}
