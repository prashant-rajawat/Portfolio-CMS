import crypto from 'crypto';
import { getDbPool } from '../db/index.ts';
import { MediaRecord } from '../types/cms.ts';
import { validateUploadedImage } from '../validators/upload.validator.ts';
import { StorageService } from './storage.service.ts';
import { DatabaseNotConfiguredError, NotFoundError } from '../utils/errors.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { logger } from '../utils/logger.ts';

export interface UploadImageParams {
  file?: Express.Multer.File;
  userId: string;
}

export class UploadService {
  /**
   * Uploads an image file to Supabase cloud storage and records metadata in PostgreSQL.
   * If database insertion fails, the uploaded file is cleaned up from storage to avoid orphan files.
   */
  public static async uploadImage(params: UploadImageParams): Promise<MediaRecord> {
    const { file, userId } = params;

    // 1. Validate file existence, size (5MB), MIME type, extension, and magic bytes
    const validated = validateUploadedImage(file);

    // 2. Generate cryptographically safe unique filename (UUID + validated extension)
    // Prevents path traversal, directory traversal, and arbitrary filesystem attacks
    const uniqueId = crypto.randomUUID();
    const safeFilename = `${uniqueId}${validated.extension}`;
    const storagePath = `images/${safeFilename}`;

    // 3. Upload to cloud storage
    let storageResult: { storagePath: string; storageUrl: string };
    try {
      storageResult = await StorageService.uploadFile(
        storagePath,
        file!.buffer,
        validated.mimeType
      );
    } catch (err: any) {
      logger.error('Failed to upload file to cloud storage:', {
        message: err.message,
        filename: safeFilename,
      });
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError('Storage service temporarily unavailable. Failed to upload image.', 500);
    }

    // 4. Record media in the database
    const pool = getDbPool();
    if (!pool) {
      // Storage upload succeeded, but database is not configured.
      // Clean up uploaded file immediately to prevent orphan assets.
      logger.warn(`Cleaning up storage file ${storageResult.storagePath} due to unavailable database pool`);
      await StorageService.deleteFile(storageResult.storagePath);
      throw new DatabaseNotConfiguredError();
    }

    const insertQuery = `
      INSERT INTO media (
        filename,
        original_filename,
        storage_path,
        storage_url,
        mime_type,
        file_size,
        uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        filename,
        original_filename,
        storage_path,
        storage_url,
        mime_type,
        file_size,
        uploaded_by,
        created_at,
        updated_at;
    `;

    try {
      const result = await pool.query(insertQuery, [
        safeFilename,
        validated.sanitizedOriginalName,
        storageResult.storagePath,
        storageResult.storageUrl,
        validated.mimeType,
        validated.size,
        userId,
      ]);

      const record = result.rows[0] as MediaRecord;
      logger.info(`Media uploaded and recorded: ${record.id} (${record.filename}) by user ${userId}`);
      return record;
    } catch (dbErr: any) {
      logger.error('Database insertion failed for media upload. Initiating storage rollback...', {
        error: dbErr.message,
        storagePath: storageResult.storagePath,
      });

      // Storage cleanup rollback
      try {
        await StorageService.deleteFile(storageResult.storagePath);
        logger.info(`Rollback successful: removed ${storageResult.storagePath} from storage`);
      } catch (cleanupErr) {
        logger.warn('Failed to cleanup orphan file after database error:', cleanupErr);
      }

      throw new AppError('Failed to save image record in database.', 500);
    }
  }

  /**
   * Retrieves a single media record by ID.
   */
  public static async getById(id: string): Promise<MediaRecord | null> {
    const pool = getDbPool();
    if (!pool) return null;

    const query = `
      SELECT
        id,
        filename,
        original_filename,
        storage_path,
        storage_url,
        mime_type,
        file_size,
        uploaded_by,
        created_at,
        updated_at
      FROM media
      WHERE id = $1
      LIMIT 1;
    `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as MediaRecord;
  }

  /**
   * Lists recent media items.
   */
  public static async getAll(): Promise<MediaRecord[]> {
    const pool = getDbPool();
    if (!pool) return [];

    const query = `
      SELECT
        id,
        filename,
        original_filename,
        storage_path,
        storage_url,
        mime_type,
        file_size,
        uploaded_by,
        created_at,
        updated_at
      FROM media
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(query);
    return result.rows as MediaRecord[];
  }

  /**
   * Safely deletes a media item by ID:
   * 1. Confirms existence and retrieves storage_path
   * 2. Deletes storage object via StorageService
   * 3. Deletes database record in PostgreSQL
   */
  public static async delete(id: string): Promise<{ id: string }> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    // 1. Verify media exists
    const media = await this.getById(id);
    if (!media) {
      throw new NotFoundError(`Media item with ID "${id}" was not found.`);
    }

    // 2. Delete storage file
    try {
      await StorageService.deleteFile(media.storage_path);
    } catch (storageErr) {
      logger.warn(`Storage deletion error for ${media.storage_path}, continuing database deletion:`, storageErr);
    }

    // 3. Delete database record
    const deleteQuery = `DELETE FROM media WHERE id = $1 RETURNING id;`;
    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      throw new NotFoundError(`Media item with ID "${id}" was not found.`);
    }

    logger.info(`Deleted media item and storage file with ID: ${id}`);
    return { id };
  }
}
