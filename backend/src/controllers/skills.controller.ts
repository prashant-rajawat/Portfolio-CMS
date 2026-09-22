import { Request, Response, NextFunction } from 'express';
import { SkillsService } from '../services/skills.service.ts';
import { sendSuccess } from '../utils/response.ts';

export class SkillsController {
  public static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skills = await SkillsService.getAll();
      sendSuccess(res, 'Skills fetched successfully', skills, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await SkillsService.create(req.body);
      sendSuccess(res, 'Skill created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await SkillsService.update(req.params.id, req.body);
      sendSuccess(res, 'Skill updated successfully', updated, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await SkillsService.delete(req.params.id);
      sendSuccess(res, 'Skill deleted successfully', result, 200);
    } catch (err) {
      next(err);
    }
  }
}
