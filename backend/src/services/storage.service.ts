import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.ts';
import { logger } from '../utils/logger.ts';
import { AppError } from '../middleware/errorHandler.ts';

export interface StorageUploadResult {
  storagePath: string;
  storageUrl: string;
}

export interface IStorageAdapter {
  upload(storagePath: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult>;
  delete(storagePath: string): Promise<void>;
  getPublicUrl(storagePath: string): string;
}

/**
 * Default production Supabase Storage adapter.
 */
class SupabaseStorageAdapter implements IStorageAdapter {
  private client: SupabaseClient | null = null;
  private bucket: string;

  constructor() {
    this.bucket = config.supabaseStorageBucket || 'portfolio-media';
    this.initClient();
  }

  private initClient(): void {
    const url = config.supabaseUrl;
    // Prefer backend service role key, fallback to publishable key if available
    const key = config.supabaseServiceRoleKey || config.supabasePublishableKey;

    if (url && key) {
      try {
        this.client = createClient(url, key, {
          auth: {
            persistSession: false,
          },
        });
      } catch (err) {
        logger.error('Failed to initialize Supabase storage client:', err);
        this.client = null;
      }
    }
  }

  public isConfigured(): boolean {
    return Boolean(config.supabaseUrl && (config.supabaseServiceRoleKey || config.supabasePublishableKey));
  }

  public async upload(storagePath: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult> {
    if (!this.client) {
      this.initClient();
    }

    if (!this.client) {
      throw new AppError(
        'Cloud storage is not configured. Please define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        503
      );
    }

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      logger.error('Supabase storage upload error:', { message: error.message });
      throw new AppError('Failed to upload file to cloud storage. Please try again.', 500);
    }

    const storageUrl = this.getPublicUrl(storagePath);
    return {
      storagePath: data?.path || storagePath,
      storageUrl,
    };
  }

  public async delete(storagePath: string): Promise<void> {
    if (!this.client) {
      this.initClient();
    }

    if (!this.client) return;

    try {
      const { error } = await this.client.storage.from(this.bucket).remove([storagePath]);
      if (error) {
        logger.warn(`Failed to cleanup file from storage [${storagePath}]: ${error.message}`);
      } else {
        logger.info(`Cleaned up orphaned file from storage: ${storagePath}`);
      }
    } catch (err) {
      logger.warn(`Unexpected error during storage cleanup [${storagePath}]:`, err);
    }
  }

  public getPublicUrl(storagePath: string): string {
    if (this.client) {
      const { data } = this.client.storage.from(this.bucket).getPublicUrl(storagePath);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    }
    // Fallback URL pattern for Supabase storage
    const base = config.supabaseUrl ? config.supabaseUrl.replace(/\/$/, '') : 'https://supabase.local';
    return `${base}/storage/v1/object/public/${this.bucket}/${storagePath}`;
  }
}

/**
 * Storage Service that wraps the storage adapter.
 * Allows mock adapter injection for offline tests without external dependencies.
 */
export class StorageService {
  private static adapter: IStorageAdapter = new SupabaseStorageAdapter();

  /**
   * Set custom adapter (e.g. mock adapter for offline tests)
   */
  public static setAdapter(customAdapter: IStorageAdapter): void {
    this.adapter = customAdapter;
  }

  /**
   * Reset to default Supabase adapter
   */
  public static resetAdapter(): void {
    this.adapter = new SupabaseStorageAdapter();
  }

  /**
   * Upload file to cloud storage
   */
  public static async uploadFile(
    storagePath: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<StorageUploadResult> {
    return this.adapter.upload(storagePath, buffer, mimeType);
  }

  /**
   * Delete file from cloud storage (used for rollback/cleanup)
   */
  public static async deleteFile(storagePath: string): Promise<void> {
    return this.adapter.delete(storagePath);
  }

  /**
   * Get public storage URL
   */
  public static getPublicUrl(storagePath: string): string {
    return this.adapter.getPublicUrl(storagePath);
  }
}
