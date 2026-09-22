import { Router } from 'express';
import { ContactController } from '../controllers/contact.controller.ts';
import { validateRequest } from '../middleware/validator.ts';
import { createContactSchema } from '../validators/contact.validator.ts';

const router = Router();

/**
 * POST /api/contact
 * Public endpoint for visitors to submit inquiries from the portfolio contact form.
 * Validates payload (name, email, subject, message) and saves inquiry to messages table.
 */
router.post(
  '/',
  validateRequest({ body: createContactSchema }),
  ContactController.submitContact
);

export default router;
