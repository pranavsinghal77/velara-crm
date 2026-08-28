import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { logger } from '../utils/logger';

export const validate =
  (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation error', { issues: error.issues });
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            details: error.issues,
          },
        });
      }
      return next(error);
    }
  };
