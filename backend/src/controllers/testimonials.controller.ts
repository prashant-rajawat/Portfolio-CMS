import { Request, Response, NextFunction } from 'express';
import { TestimonialsService } from '../services/testimonials.service.ts';
import { sendSuccess } from '../utils/response.ts';

export class TestimonialsController {
  public static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await TestimonialsService.getAll();
      sendSuccess(res, 'Testimonials fetched successfully', items, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await TestimonialsService.create(req.body);
      sendSuccess(res, 'Testimonial created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await TestimonialsService.update(req.params.id, req.body);
      sendSuccess(res, 'Testimonial updated successfully', updated, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await TestimonialsService.delete(req.params.id);
      sendSuccess(res, 'Testimonial deleted successfully', result, 200);
    } catch (err) {
      next(err);
    }
  }
}
