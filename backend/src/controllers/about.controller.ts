import { Request, Response, NextFunction } from 'express';
import { AboutService } from '../services/about.service.ts';
import { sendSuccess } from '../utils/response.ts';

export class AboutController {
  public static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const about = await AboutService.getAbout();
      if (!about) {
        sendSuccess(res, 'About profile is not yet configured', null, 200);
        return;
      }
      sendSuccess(res, 'About profile retrieved successfully', about, 200);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await AboutService.upsertAbout(req.body);
      sendSuccess(res, 'About profile updated successfully', updated, 200);
    } catch (err) {
      next(err);
    }
  }
}
