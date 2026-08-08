import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { MulterError } from 'multer';
import { ApiError } from '@utils/ApiError';
import { logger } from '@utils/logger';
import { env } from '@config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 422;
    message = 'Validation failed';
    details = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => e.message);
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for field "${err.path}"`;
  } else if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: number }).code === 11000) {
    statusCode = 409;
    message = 'Duplicate value violates a unique constraint';
    details = (err as { keyValue?: unknown }).keyValue;
  } else if (err instanceof MulterError) {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the maximum allowed size (10MB)' : err.message;
  } else if (err instanceof Error) {
    message = env.isProduction ? message : err.message;
  }

  if (statusCode >= 500) {
    logger.error(message, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(env.isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
}
