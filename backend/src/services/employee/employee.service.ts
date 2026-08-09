import { IEmployee } from '@models/Employee.model';
import { Department } from '@models/Department.model';
import { Position } from '@models/Position.model';
import { User } from '@models/User.model';
import { ApiError } from '@utils/ApiError';
import { nextSequentialId } from '@utils/idGenerator';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';
import * as employeeRepository from '@repositories/employee.repository';

interface EmployeeFilters {
  search?: string;
  department?: string;
  position?: string;
  status?: string;
  employmentType?: string;
}

async function assertDepartmentExists(departmentId?: string): Promise<void> {
  if (!departmentId) return;
  const exists = await Department.exists({ _id: departmentId });
  if (!exists) throw ApiError.badRequest('Department not found');
}

async function assertPositionExists(positionId?: string): Promise<void> {
  if (!positionId) return;
  const exists = await Position.exists({ _id: positionId });
  if (!exists) throw ApiError.badRequest('Position not found');
}

export async function listEmployees(filters: EmployeeFilters, pagination: PaginationParams) {
  const { docs, total } = await employeeRepository.search({ ...filters, ...pagination });
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function listDirectory(): Promise<IEmployee[]> {
  return employeeRepository.searchDirectory();
}

export async function getEmployee(id: string, includeSalary = false): Promise<IEmployee> {
  const employee = await employeeRepository.findById(id, includeSalary);
  if (!employee) throw ApiError.notFound('Employee not found');
  return employee;
}

export async function createEmployee(data: Partial<IEmployee>): Promise<IEmployee> {
  await Promise.all([
    assertDepartmentExists(data.department?.toString()),
    assertPositionExists(data.position?.toString()),
  ]);

  if (data.email) {
    const existing = await employeeRepository.findByEmail(data.email);
    if (existing) throw ApiError.conflict('An employee with this email already exists');
  }

  const employeeId = data.employeeId ?? (await nextSequentialId('employee', 'EMP'));

  return employeeRepository.create({ ...data, employeeId: employeeId.toUpperCase() });
}

export async function updateEmployee(id: string, data: Partial<IEmployee>, includeSalary = false): Promise<IEmployee> {
  await getEmployee(id);

  await Promise.all([
    assertDepartmentExists(data.department?.toString()),
    assertPositionExists(data.position?.toString()),
  ]);

  if (data.email) {
    const existing = await employeeRepository.findByEmail(data.email);
    if (existing && existing.id !== id) {
      throw ApiError.conflict('Another employee already uses this email');
    }
  }

  const updated = await employeeRepository.updateById(id, data, includeSalary);
  if (!updated) throw ApiError.notFound('Employee not found');
  return updated;
}

interface OwnProfileUpdate {
  phone?: string;
  photo?: string;
  address?: IEmployee['address'];
  emergencyContact?: IEmployee['emergencyContact'];
}

/** Self-service update — the caller already knows this only accepts a narrow,
 * pre-validated field set (see updateOwnProfileSchema); no department/position/
 * status/salary/employmentType can pass through here. */
export async function updateOwnProfile(id: string, data: OwnProfileUpdate): Promise<IEmployee> {
  const updated = await employeeRepository.updateById(id, data);
  if (!updated) throw ApiError.notFound('Employee not found');
  return updated;
}

export async function deactivateEmployee(id: string): Promise<IEmployee> {
  const employee = await getEmployee(id);
  employee.status = 'terminated';
  await employee.save();

  if (employee.user) {
    await User.updateOne({ _id: employee.user }, { $set: { isActive: false } });
  }

  return employee;
}
