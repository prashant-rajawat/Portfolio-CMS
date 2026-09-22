import { Router } from 'express';
import { HealthController } from '../controllers/health.controller.ts';

const router = Router();

router.get('/', HealthController.getHealth);
router.get('/db', HealthController.getDbHealth);

export default router;
