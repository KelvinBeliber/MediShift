import { Types } from 'mongoose';
import { Employee } from '@models/Employee.model';
import { Department } from '@models/Department.model';
import { ApiError } from '@utils/ApiError';
import { PERMISSIONS } from '@constants/permissions';
import type { Request } from 'express';

/**
 * The authenticated caller, as `authenticate` writes it onto the request.
 *
 * Derived from `Request` rather than imported from `src/types/express/index.d.ts`
 * — the `@types/*` path alias collides with the real `@types` package scope, so
 * a direct import of that declaration file does not compile.
 */
type AuthenticatedUser = NonNullable<Request['user']>;

/**
 * Who is asking, and what they are allowed to be told.
 *
 * This is resolved once, server-side, before the model is ever invoked, and
 * every tool executor takes it as a parameter. The model is never given a
 * department id to choose from beyond what this permits, and — more importantly
 * — it is never *trusted* to respect one: `resolveDepartmentFilter` below
 * overrides whatever department the model asked for whenever the caller is
 * department-scoped. A prompt-injected or simply confused model cannot widen
 * its own reach, because widening it is not a code path that exists.
 */
export interface AssistantScope {
  userId: string;
  roleName: string;
  /**
   * `hospital` — may ask about any department, and about all of them at once.
   * `department` — every tool call is silently pinned to `departmentId`.
   */
  mode: 'hospital' | 'department';
  /** Always set when `mode === 'department'`. */
  departmentId?: string;
  departmentName?: string;
}

/**
 * The split reuses the permission model that already gates Reports rather than
 * inventing an assistant-specific one:
 *
 * - `analytics:view` is the hospital-wide half — it is what the cross-department
 *   `/reports/department-utilization` view is built around, and only HR Manager,
 *   Hospital Admin and Super Admin hold it.
 * - `report:view` alone is the single-department half. Department Head holds
 *   exactly this, and their reach is their own department.
 *
 * A role holding neither never reaches this code — `authorizeAny` on the route
 * has already returned 403 — which is what keeps Employees and Shift
 * Coordinators out of the feature entirely.
 */
export async function resolveScope(user: AuthenticatedUser): Promise<AssistantScope> {
  const base = { userId: user.id, roleName: user.roleName };

  if (user.permissions.includes(PERMISSIONS.ANALYTICS_VIEW)) {
    return { ...base, mode: 'hospital' };
  }

  // Department-scoped from here down. The department comes from the caller's own
  // Employee record — never from the request body, and never from the model.
  if (!user.employeeId) {
    throw ApiError.forbidden(
      'The assistant answers questions about your department, but your account is not linked to an employee record. Ask HR to link it.'
    );
  }

  const employee = await Employee.findById(user.employeeId).select('department');
  if (!employee?.department) {
    throw ApiError.forbidden(
      'The assistant answers questions about your department, but your employee record has no department assigned. Ask HR to assign one.'
    );
  }

  const department = await Department.findById(employee.department).select('name');

  return {
    ...base,
    mode: 'department',
    departmentId: employee.department.toString(),
    departmentName: department?.name,
  };
}

/**
 * The single choke point every tool passes its `department` argument through.
 *
 * For a department-scoped caller the model's argument is discarded outright —
 * not validated against the scope and rejected, just replaced. Rejecting would
 * leak which department ids exist by the shape of the error; replacing means a
 * Department Head who asks about Cardiology while running the ICU gets an answer
 * about the ICU, and the tool result they see says so.
 */
export function resolveDepartmentFilter(
  scope: AssistantScope,
  requested?: string
): { departmentId?: string; coerced: boolean } {
  if (scope.mode === 'department') {
    const coerced = Boolean(requested) && requested !== scope.departmentId;
    return { departmentId: scope.departmentId, coerced };
  }

  if (requested && !Types.ObjectId.isValid(requested)) {
    throw ApiError.badRequest(`"${requested}" is not a valid department id`);
  }

  return { departmentId: requested, coerced: false };
}

/** Human-readable description of the caller's reach, for the system prompt. */
export function describeScope(scope: AssistantScope): string {
  if (scope.mode === 'hospital') {
    return 'every department in the hospital';
  }
  return `the ${scope.departmentName ?? 'assigned'} department only`;
}
