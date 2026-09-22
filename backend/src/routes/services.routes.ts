import { Router } from 'express';
import { ServicesController } from '../controllers/services.controller.ts';
import { authenticateToken } from '../middleware/authenticateToken.ts';
import { requireAdmin } from '../middleware/requireAdmin.ts';
import { validateRequest } from '../middleware/validator.ts';
import { uuidParamSchema } from '../validators/common.validator.ts';
import { createServiceSchema, updateServiceSchema } from '../validators/services.validator.ts';

const router = Router();

// Public endpoint
router.get('/', ServicesController.getAll);

// Protected Admin mutation endpoints
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest({ body: createServiceSchema }),
  ServicesController.create
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema, body: updateServiceSchema }),
  ServicesController.update
);

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema }),
  ServicesController.delete
);

export default router;
