import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function getPaginationParams(req: Request): PaginationParams {
  const page = Math.max(DEFAULT_PAGE, Number(req.query.page) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  const sortParam = typeof req.query.sort === 'string' ? req.query.sort : '-createdAt';
  const sort: Record<string, 1 | -1> = {};
  for (const field of sortParam.split(',')) {
    if (field.startsWith('-')) {
      sort[field.slice(1)] = -1;
    } else if (field) {
      sort[field] = 1;
    }
  }

  return { page, limit, skip, sort };
}

export function buildPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
