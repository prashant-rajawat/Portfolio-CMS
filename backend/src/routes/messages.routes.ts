import { Router } from 'express';
import { ContactController } from '../controllers/contact.controller.ts';
import { authenticateToken } from '../middleware/authenticateToken.ts';
import { requireAdmin } from '../middleware/requireAdmin.ts';
import { validateRequest } from '../middleware/validator.ts';
import { uuidParamSchema } from '../validators/common.validator.ts';
import { updateReadStatusSchema } from '../validators/contact.validator.ts';

const router = Router();

/**
 * All /api/messages routes require valid JWT authentication and Administrator role.
 */
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/messages
 * Retrieves all contact messages sorted chronologically (newest first).
 */
router.get('/', ContactController.getAll);

/**
 * GET /api/messages/:id
 * Retrieves a single contact message details by UUID.
 */
router.get(
  '/:id',
  validateRequest({ params: uuidParamSchema }),
  ContactController.getById
);

/**
 * PUT /api/messages/:id/read
 * Marks a message as read (or unread).
 */
router.put(
  '/:id/read',
  validateRequest({
    params: uuidParamSchema,
    body: updateReadStatusSchema,
  }),
  ContactController.markAsRead
);

/**
 * DELETE /api/messages/:id
 * Permanently removes a contact message record.
 */
router.delete(
  '/:id',
  validateRequest({ params: uuidParamSchema }),
  ContactController.delete
);

export default router;
