import { Request, Response, NextFunction } from 'express';
import { ProjectsService } from '../services/projects.service.ts';
import { sendSuccess } from '../utils/response.ts';

export class ProjectsController {
  public static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projects = await ProjectsService.getAll();
      sendSuccess(res, 'Projects fetched successfully', projects, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await ProjectsService.create(req.body);
      sendSuccess(res, 'Project created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await ProjectsService.update(req.params.id, req.body);
      sendSuccess(res, 'Project updated successfully', updated, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ProjectsService.delete(req.params.id);
      sendSuccess(res, 'Project deleted successfully', result, 200);
    } catch (err) {
      next(err);
    }
  }
}
