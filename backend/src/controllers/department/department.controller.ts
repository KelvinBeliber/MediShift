import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import * as departmentService from '@services/department/department.service';
import { recordAudit } from '@services/audit/audit.service';

export const getDepartments = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationParams(req);
  const { docs, meta } = await departmentService.listDepartments(pagination);
  sendSuccess(res, 200, 'Departments retrieved', docs, meta);
});

export const getDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentService.getDepartment(paramId(req.params.id));
  sendSuccess(res, 200, 'Department retrieved', department);
});

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentService.createDepartment(req.body);
  recordAudit({ userId: req.user?.id, action: 'CREATE', entityType: 'Department', entityId: department.id, after: department, req });
  sendSuccess(res, 201, 'Department created', department);
});

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentService.updateDepartment(paramId(req.params.id), req.body);
  recordAudit({ userId: req.user?.id, action: 'UPDATE', entityType: 'Department', entityId: department.id, after: department, req });
  sendSuccess(res, 200, 'Department updated', department);
});

export const deactivateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentService.deactivateDepartment(paramId(req.params.id));
  recordAudit({ userId: req.user?.id, action: 'DELETE', entityType: 'Department', entityId: department.id, after: department, req });
  sendSuccess(res, 200, 'Department deactivated', department);
});

export const assignManager = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentService.assignManager(paramId(req.params.id), req.body.employeeId);
  sendSuccess(res, 200, 'Department manager assigned', department);
});

export const assignEmployees = asyncHandler(async (req: Request, res: Response) => {
  const result = await departmentService.assignEmployees(paramId(req.params.id), req.body.employeeIds);
  sendSuccess(res, 200, 'Employees assigned to department', result);
});

export const getDepartmentStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await departmentService.getDepartmentStats(paramId(req.params.id));
  sendSuccess(res, 200, 'Department statistics retrieved', stats);
});
