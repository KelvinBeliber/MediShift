import { Types } from 'mongoose';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  employeeId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      // Express 5 made `req.query` a read-only getter, so validated/coerced
      // query input is stashed here instead of reassigning `req.query`.
      validatedQuery?: Record<string, unknown>;
    }
  }
}

export {};
