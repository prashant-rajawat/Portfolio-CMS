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
import contactRoutes from './contact.routes.ts';
import messagesRoutes from './messages.routes.ts';

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

// 5. Contact & Messages routes
rootRouter.use('/contact', contactRoutes);
rootRouter.use('/messages', messagesRoutes);

export default rootRouter;
