import { Router } from 'express';
import { SkillsController } from '../controllers/skills.controller.ts';
import { authenticateToken } from '../middleware/authenticateToken.ts';
import { requireAdmin } from '../middleware/requireAdmin.ts';
import { validateRequest } from '../middleware/validator.ts';
import { uuidParamSchema } from '../validators/common.validator.ts';
import { createSkillSchema, updateSkillSchema } from '../validators/skills.validator.ts';

const router = Router();

// Public endpoint
router.get('/', SkillsController.getAll);

// Protected Admin mutation endpoints
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest({ body: createSkillSchema }),
  SkillsController.create
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema, body: updateSkillSchema }),
  SkillsController.update
);

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema }),
  SkillsController.delete
);

export default router;
