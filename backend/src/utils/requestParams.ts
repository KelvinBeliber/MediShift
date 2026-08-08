import { ApiError } from './ApiError';

/**
 * Express types `req.params[key]` as `string | string[]` to account for wildcard
 * route captures. Our routes never use wildcards, so this narrows it back to `string`.
 */
export function paramId(value: string | string[] | undefined, name = 'id'): string {
  if (typeof value !== 'string') {
    throw ApiError.badRequest(`Invalid route parameter: ${name}`);
  }
  return value;
}
