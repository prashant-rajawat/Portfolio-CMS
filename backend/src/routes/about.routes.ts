import { Router } from 'express';
import { AboutController } from '../controllers/about.controller.ts';
import { authenticateToken } from '../middleware/authenticateToken.ts';
import { requireAdmin } from '../middleware/requireAdmin.ts';
import { validateRequest } from '../middleware/validator.ts';
import { updateAboutSchema } from '../validators/about.validator.ts';

const router = Router();

// Public endpoint
router.get('/', AboutController.get);

// Protected Admin mutation endpoint
router.put(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest({ body: updateAboutSchema }),
  AboutController.update
);

export default router;
