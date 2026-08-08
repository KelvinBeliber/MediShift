import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validateRequest(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        // Express 5's `req.query` is a read-only getter — stash the validated
        // result separately instead of reassigning it.
        req.validatedQuery = schemas.query.parse(req.query) as Record<string, unknown>;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
