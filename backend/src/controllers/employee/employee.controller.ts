import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import * as employeeService from '@services/employee/employee.service';
import { recordAudit } from '@services/audit/audit.service';
import { PERMISSIONS } from '@constants/permissions';

function canSeeSalary(req: Request): boolean {
  return Boolean(req.user?.permissions.includes(PERMISSIONS.EMPLOYEE_EDIT));
}

export const getEmployees = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationParams(req);
  const { search, department, position, status, employmentType } = (req.validatedQuery ?? {}) as Record<
    string,
    string | undefined
  >;

  const { docs, meta } = await employeeService.listEmployees(
    { search, department, position, status, employmentType },
    pagination
  );

  sendSuccess(res, 200, 'Employees retrieved', docs, meta);
});

export const getOwnProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.employeeId) {
    throw ApiError.badRequest('No employee profile is linked to this account');
  }
  const employee = await employeeService.getEmployee(req.user.employeeId);
  sendSuccess(res, 200, 'Profile retrieved', employee);
});

export const updateOwnProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.employeeId) {
    throw ApiError.badRequest('No employee profile is linked to this account');
  }
  const employee = await employeeService.updateOwnProfile(req.user.employeeId, req.body);
  sendSuccess(res, 200, 'Profile updated', employee);
});

export const getEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.getEmployee(paramId(req.params.id), canSeeSalary(req));
  sendSuccess(res, 200, 'Employee retrieved', employee);
});

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.createEmployee(req.body);
  recordAudit({ userId: req.user?.id, action: 'CREATE', entityType: 'Employee', entityId: employee.id, after: employee, req });
  sendSuccess(res, 201, 'Employee created', employee);
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  // Route already requires employee:edit, so this is always true here — kept
  // explicit for symmetry with getEmployee rather than assuming.
  const employee = await employeeService.updateEmployee(paramId(req.params.id), req.body, canSeeSalary(req));
  recordAudit({ userId: req.user?.id, action: 'UPDATE', entityType: 'Employee', entityId: employee.id, after: employee, req });
  sendSuccess(res, 200, 'Employee updated', employee);
});

export const deactivateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.deactivateEmployee(paramId(req.params.id));
  recordAudit({ userId: req.user?.id, action: 'DELETE', entityType: 'Employee', entityId: employee.id, after: employee, req });
  sendSuccess(res, 200, 'Employee deactivated', employee);
});
