import { Request, Response, NextFunction } from 'express';
import { UploadService } from '../services/upload.service.ts';
import { sendSuccess } from '../utils/response.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class UploadController {
  /**
   * Handles POST /api/upload/image
   * Requires authenticated admin user.
   */
  public static async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required to upload media.', 401);
      }

      const mediaRecord = await UploadService.uploadImage({
        file: req.file,
        userId: req.user.id,
      });

      sendSuccess(res, 'Image uploaded successfully', mediaRecord, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles GET /api/upload/:id (Retrieve uploaded media details)
   */
  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const media = await UploadService.getById(req.params.id);
      if (!media) {
        throw new AppError('Media record not found.', 404);
      }
      sendSuccess(res, 'Media retrieved successfully', media, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles GET /api/upload (List uploaded media)
   */
  public static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const mediaList = await UploadService.getAll();
      sendSuccess(res, 'Media items retrieved successfully', mediaList, 200);
    } catch (err) {
      next(err);
    }
  }
}
