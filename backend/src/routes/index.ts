import { Router, Request, Response } from 'express';
import healthRoutes from './health.routes.ts';
import authRoutes from './auth.routes.ts';
import aboutRoutes from './about.routes.ts';
import skillsRoutes from './skills.routes.ts';
import projectsRoutes from './projects.routes.ts';
import blogsRoutes from './blogs.routes.ts';
import experienceRoutes from './experience.routes.ts';
import testimonialsRoutes from './testimonials.routes.ts';
import servicesRoutes from './services.routes.ts';
import uploadRoutes from './upload.routes.ts';

const rootRouter = Router();

// 1. Health API routes
rootRouter.use('/health', healthRoutes);

// 2. Authentication routes
rootRouter.use('/auth', authRoutes);

// 3. CMS CRUD API modules
rootRouter.use('/about', aboutRoutes);
rootRouter.use('/skills', skillsRoutes);
rootRouter.use('/projects', projectsRoutes);
rootRouter.use('/blogs', blogsRoutes);
rootRouter.use('/experience', experienceRoutes);
rootRouter.use('/testimonials', testimonialsRoutes);
rootRouter.use('/services', servicesRoutes);

// 4. Media upload route
rootRouter.use('/upload', uploadRoutes);

/**
 * Placeholder handler for reserved future routes (Contact).
 * Strictly avoids fake CRUD or mock data until future steps.
 */
function createPlaceholderRoute(name: string): Router {
  const router = Router();
  router.all('*', (req: Request, res: Response) => {
    res.status(501).json({
      success: false,
      message: `The ${name} API route (${req.method} ${req.originalUrl}) is reserved and will be implemented in upcoming steps.`,
    });
  });
  return router;
}

// 5. Reserved API routes for future steps
rootRouter.use('/contact', createPlaceholderRoute('Contact'));

export default rootRouter;
