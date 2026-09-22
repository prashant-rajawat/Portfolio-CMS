import { Request, Response, NextFunction } from 'express';
import { BlogsService } from '../services/blogs.service.ts';
import { sendSuccess } from '../utils/response.ts';
import { NotFoundError } from '../utils/errors.ts';

export class BlogsController {
  public static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const blogs = await BlogsService.getAll();
      sendSuccess(res, 'Blogs fetched successfully', blogs, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const blog = await BlogsService.getBySlug(req.params.slug);
      if (!blog) {
        throw new NotFoundError(`Blog post with slug '${req.params.slug}' not found`);
      }
      sendSuccess(res, 'Blog post fetched successfully', blog, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Use authenticated admin's ID as the author
      const adminUserId = req.user?.id;
      const created = await BlogsService.create(req.body, adminUserId);
      sendSuccess(res, 'Blog post created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await BlogsService.update(req.params.id, req.body);
      sendSuccess(res, 'Blog post updated successfully', updated, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await BlogsService.delete(req.params.id);
      sendSuccess(res, 'Blog post deleted successfully', result, 200);
    } catch (err) {
      next(err);
    }
  }
}
