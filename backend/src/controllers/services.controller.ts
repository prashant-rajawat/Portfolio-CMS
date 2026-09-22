import { Request, Response, NextFunction } from 'express';
import { ServicesService } from '../services/services.service.ts';
import { sendSuccess } from '../utils/response.ts';

export class ServicesController {
  public static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await ServicesService.getAll();
      sendSuccess(res, 'Services fetched successfully', items, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await ServicesService.create(req.body);
      sendSuccess(res, 'Service created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await ServicesService.update(req.params.id, req.body);
      sendSuccess(res, 'Service updated successfully', updated, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ServicesService.delete(req.params.id);
      sendSuccess(res, 'Service deleted successfully', result, 200);
    } catch (err) {
      next(err);
    }
  }
}
