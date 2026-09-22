import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { sendError } from '../utils/response.ts';
import { MAX_FILE_SIZE_BYTES } from '../validators/upload.validator.ts';

// Configure multer memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 5 MB early rejection
    files: 1,
  },
});

/**
 * Middleware that parses and validates single file multipart upload for field 'file'.
 * Translates multer errors directly to HTTP 400 with clear user-facing messages.
 */
export function uploadSingleImage(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          sendError(res, 'File size exceeds the 5 MB maximum limit.', 400);
          return;
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          sendError(res, 'Unexpected multipart field. Upload requires single file in field "file".', 400);
          return;
        }
        sendError(res, `Upload error: ${err.message}`, 400);
        return;
      }
      return next(err);
    }
    next();
  });
}
