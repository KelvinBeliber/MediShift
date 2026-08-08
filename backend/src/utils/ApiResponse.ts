import { Response } from 'express';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
  pagination?: Pagination
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
    ...(pagination ? { pagination } : {}),
  });
}
