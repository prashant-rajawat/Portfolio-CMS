import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller.ts';
import { authenticateToken } from '../middleware/authenticateToken.ts';
import { requireAdmin } from '../middleware/requireAdmin.ts';
import { uploadSingleImage } from '../middleware/upload.middleware.ts';

const router = Router();

/**
 * POST /api/upload/image
 * Secure media/image upload endpoint.
 * Requires:
 * 1. authenticateToken (rejects missing/invalid JWT with 401)
 * 2. requireAdmin (rejects authenticated non-admin with 403)
 * 3. uploadSingleImage (multipart parsing with 5 MB limit, field name 'file')
 */
router.post(
  '/image',
  authenticateToken,
  requireAdmin,
  uploadSingleImage,
  UploadController.uploadImage
);

/**
 * GET /api/upload
 * Lists uploaded media metadata for admin review
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  UploadController.getAll
);

/**
 * GET /api/upload/:id
 * Retrieve specific media metadata by UUID
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  UploadController.getById
);

export default router;
