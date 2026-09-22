import { Router } from 'express';
import { ProjectsController } from '../controllers/projects.controller.ts';
import { authenticateToken } from '../middleware/authenticateToken.ts';
import { requireAdmin } from '../middleware/requireAdmin.ts';
import { validateRequest } from '../middleware/validator.ts';
import { uuidParamSchema } from '../validators/common.validator.ts';
import { createProjectSchema, updateProjectSchema } from '../validators/projects.validator.ts';

const router = Router();

// Public endpoint
router.get('/', ProjectsController.getAll);

// Protected Admin mutation endpoints
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest({ body: createProjectSchema }),
  ProjectsController.create
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema, body: updateProjectSchema }),
  ProjectsController.update
);

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema }),
  ProjectsController.delete
);

export default router;
