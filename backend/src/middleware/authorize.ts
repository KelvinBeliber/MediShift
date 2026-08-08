import { NextFunction, Request, Response } from 'express';
import { ApiError } from '@utils/ApiError';
import { PermissionName } from '@constants/permissions';

/**
 * Requires the authenticated user to hold ALL of the given permissions.
 * Must run after `authenticate`.
 */
export function authorize(...requiredPermissions: PermissionName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    const missing = requiredPermissions.filter((p) => !req.user!.permissions.includes(p));
    if (missing.length > 0) {
      return next(ApiError.forbidden(`Missing required permission(s): ${missing.join(', ')}`));
    }

    next();
  };
}

/**
 * Requires the authenticated user to hold AT LEAST ONE of the given permissions.
 */
export function authorizeAny(...anyPermissions: PermissionName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    const hasAny = anyPermissions.some((p) => req.user!.permissions.includes(p));
    if (!hasAny) {
      return next(ApiError.forbidden(`Requires at least one of: ${anyPermissions.join(', ')}`));
    }

    next();
  };
}
