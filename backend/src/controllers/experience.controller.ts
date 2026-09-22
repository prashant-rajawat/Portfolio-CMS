import { Request, Response, NextFunction } from 'express';
import { ExperienceService } from '../services/experience.service.ts';
import { sendSuccess } from '../utils/response.ts';

export class ExperienceController {
  public static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await ExperienceService.getAll();
      sendSuccess(res, 'Experience history fetched successfully', items, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await ExperienceService.create(req.body);
      sendSuccess(res, 'Experience entry created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await ExperienceService.update(req.params.id, req.body);
      sendSuccess(res, 'Experience entry updated successfully', updated, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ExperienceService.delete(req.params.id);
      sendSuccess(res, 'Experience entry deleted successfully', result, 200);
    } catch (err) {
      next(err);
    }
  }
}
