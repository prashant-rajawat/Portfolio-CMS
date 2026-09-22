import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response.ts';

export interface RequestValidationSchema {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Reusable request validation middleware foundation using Zod.
 * Validates req.body, req.query, and/or req.params against provided schemas.
 * Returns standard 400 Bad Request response with cleanly mapped errors.
 */
export function validateRequest(schemas: RequestValidationSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.params) {
        const parsedParams = await schemas.params.parseAsync(req.params);
        req.params = parsedParams as typeof req.params;
      }
      if (schemas.query) {
        const parsedQuery = await schemas.query.parseAsync(req.query);
        req.query = parsedQuery as typeof req.query;
      }
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = (error as ZodError).issues || [];
        const formattedErrors = issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        sendError(res, 'Validation failed for the request payload', 400, formattedErrors);
        return;
      }
      next(error);
    }
  };
}
