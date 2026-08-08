import { NextFunction, Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { ApiError } from '@utils/ApiError';
import { verifyAccessToken } from '@utils/jwt';
import { User } from '@models/User.model';
import { Role } from '@models/Role.model';
import { IPermission } from '@models/Permission.model';

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  return req.cookies?.accessToken;
}

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    throw ApiError.unauthorized('Authentication token missing');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is inactive or no longer exists');
  }

  const role = await Role.findById(user.role).populate<{ permissions: IPermission[] }>('permissions');
  if (!role) {
    throw ApiError.unauthorized('User role could not be resolved');
  }

  req.user = {
    id: user.id,
    email: user.email,
    roleId: role.id,
    roleName: role.name,
    permissions: role.permissions.map((p) => p.key),
    employeeId: user.employee?.toString(),
  };

  next();
});

export const optionalAuthenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user?.isActive) {
      const role = await Role.findById(user.role).populate<{ permissions: IPermission[] }>('permissions');
      if (role) {
        req.user = {
          id: user.id,
          email: user.email,
          roleId: role.id,
          roleName: role.name,
          permissions: role.permissions.map((p) => p.key),
          employeeId: user.employee?.toString(),
        };
      }
    }
  } catch {
    // ignore invalid token for optional auth
  }

  next();
});
