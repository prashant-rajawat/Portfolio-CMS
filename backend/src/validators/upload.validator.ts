import path from 'path';
import { BadRequestError } from '../utils/errors.ts';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
] as const;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

/**
 * Validates the file header magic bytes to verify actual image content.
 * Prevents disguised executables or arbitrary files renamed with image extensions.
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 12) {
    return false;
  }

  // 1. JPEG: FF D8 FF
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // 3. WebP: 'RIFF' at 0..3 and 'WEBP' at 8..11
  if (mimeType === 'image/webp') {
    const isRiff =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46; // 'RIFF'
    const isWebp =
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50; // 'WEBP'
    return isRiff && isWebp;
  }

  return false;
}

export interface ValidatedFileData {
  extension: AllowedExtension;
  mimeType: AllowedMimeType;
  sanitizedOriginalName: string;
  size: number;
}

/**
 * Validates uploaded image file against size, MIME type, extension, and magic bytes.
 */
export function validateUploadedImage(file?: Express.Multer.File): ValidatedFileData {
  if (!file) {
    throw new BadRequestError('No image file provided. Request must include a multipart file in field "file".');
  }

  // Enforce 5 MB maximum size limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new BadRequestError('File size exceeds the 5 MB maximum limit.');
  }

  if (!file.originalname || typeof file.originalname !== 'string') {
    throw new BadRequestError('Uploaded file is missing an original filename.');
  }

  // Sanitize original filename (strip directories, control chars, path traversal)
  const baseName = path.basename(file.originalname).trim();
  if (!baseName || baseName === '.' || baseName === '..') {
    throw new BadRequestError('Invalid or unsafe original filename.');
  }
  const sanitizedOriginalName = baseName.substring(0, 255);

  // Validate extension
  const rawExt = path.extname(sanitizedOriginalName).toLowerCase();
  if (!rawExt || !ALLOWED_EXTENSIONS.includes(rawExt as AllowedExtension)) {
    throw new BadRequestError(
      `Unsupported file extension "${rawExt}". Allowed extensions are: ${ALLOWED_EXTENSIONS.join(', ')}`
    );
  }
  const extension = rawExt as AllowedExtension;

  // Validate MIME type
  const rawMime = file.mimetype.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(rawMime as AllowedMimeType)) {
    throw new BadRequestError(
      `Unsupported MIME type "${file.mimetype}". Allowed types are: ${ALLOWED_MIME_TYPES.join(', ')}`
    );
  }
  const mimeType = rawMime as AllowedMimeType;

  // Cross-validate extension matches MIME type
  if ((extension === '.jpg' || extension === '.jpeg') && mimeType !== 'image/jpeg') {
    throw new BadRequestError('File extension (.jpg/.jpeg) does not match MIME type.');
  }
  if (extension === '.png' && mimeType !== 'image/png') {
    throw new BadRequestError('File extension (.png) does not match MIME type.');
  }
  if (extension === '.webp' && mimeType !== 'image/webp') {
    throw new BadRequestError('File extension (.webp) does not match MIME type.');
  }

  // Inspect file signature (magic bytes)
  if (!file.buffer || !validateMagicBytes(file.buffer, mimeType)) {
    throw new BadRequestError(
      'File signature (magic bytes) does not match the expected image format. The file content may be corrupted or disguised.'
    );
  }

  return {
    extension,
    mimeType,
    sanitizedOriginalName,
    size: file.size,
  };
}
