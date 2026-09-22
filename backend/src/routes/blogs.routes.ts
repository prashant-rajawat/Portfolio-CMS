import { Router } from 'express';
import { BlogsController } from '../controllers/blogs.controller.ts';
import { authenticateToken } from '../middleware/authenticateToken.ts';
import { requireAdmin } from '../middleware/requireAdmin.ts';
import { validateRequest } from '../middleware/validator.ts';
import { uuidParamSchema } from '../validators/common.validator.ts';
import { createBlogSchema, updateBlogSchema } from '../validators/blogs.validator.ts';

const router = Router();

// Public endpoint
router.get('/', BlogsController.getAll);

// Protected Admin mutation endpoints
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest({ body: createBlogSchema }),
  BlogsController.create
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema, body: updateBlogSchema }),
  BlogsController.update
);

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest({ params: uuidParamSchema }),
  BlogsController.delete
);

export default router;
