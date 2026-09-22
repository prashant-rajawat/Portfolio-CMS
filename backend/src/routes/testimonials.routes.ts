import { Router } from 'express';
import { TestimonialsController } from '../controllers/testimonials.controller.ts';
import { authenticateToken } from '../middleware/authenticateToken.ts';
import { requireAdmin } from '../middleware/requireAdmin.ts';
import { validateRequest } from '../middleware/validator.ts';
import { uuidParamSchema } from '../validators/common.validator.ts';
import { createTestimonialSchema, updateTestimonialSchema } from '../validators/testimonials.validator.ts';

const router = Router();

// Public endpoint
router.get('/', TestimonialsController.getAll);

// Protected Admin mutation endpoints
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest({ body: createTestimonialSchema }),
  TestimonialsController.create
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema, body: updateTestimonialSchema }),
  TestimonialsController.update
);

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema }),
  TestimonialsController.delete
);

export default router;
