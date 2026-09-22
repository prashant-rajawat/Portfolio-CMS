import { Router } from 'express';
import { ExperienceController } from '../controllers/experience.controller.ts';
import { authenticateToken } from '../middleware/authenticateToken.ts';
import { requireAdmin } from '../middleware/requireAdmin.ts';
import { validateRequest } from '../middleware/validator.ts';
import { uuidParamSchema } from '../validators/common.validator.ts';
import { createExperienceSchema, updateExperienceSchema } from '../validators/experience.validator.ts';

const router = Router();

// Public endpoint
router.get('/', ExperienceController.getAll);

// Protected Admin mutation endpoints
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest({ body: createExperienceSchema }),
  ExperienceController.create
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema, body: updateExperienceSchema }),
  ExperienceController.update
);

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema }),
  ExperienceController.delete
);

export default router;
