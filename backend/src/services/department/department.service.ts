import { Types } from 'mongoose';
import { Department, IDepartment } from '@models/Department.model';
import { Employee } from '@models/Employee.model';
import { ApiError } from '@utils/ApiError';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';

export async function listDepartments(pagination: PaginationParams) {
  const filter = {};
  const [docs, total] = await Promise.all([
    Department.find(filter).populate('manager', 'firstName lastName employeeId').sort(pagination.sort).skip(pagination.skip).limit(pagination.limit),
    Department.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getDepartment(id: string): Promise<IDepartment> {
  const department = await Department.findById(id)
    .populate('manager', 'firstName lastName employeeId')
    .populate('employees', 'firstName lastName employeeId status');
  if (!department) throw ApiError.notFound('Department not found');
  return department;
}

export async function createDepartment(data: Partial<IDepartment>): Promise<IDepartment> {
  const existing = await Department.findOne({ $or: [{ name: data.name }, { code: data.code }] });
  if (existing) throw ApiError.conflict('A department with this name or code already exists');
  return Department.create(data);
}

export async function updateDepartment(id: string, data: Partial<IDepartment>): Promise<IDepartment> {
  if (data.name || data.code) {
    const existing = await Department.findOne({
      _id: { $ne: id },
      $or: [{ name: data.name }, { code: data.code }],
    });
    if (existing) throw ApiError.conflict('A department with this name or code already exists');
  }

  const department = await Department.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!department) throw ApiError.notFound('Department not found');
  return department;
}

export async function deactivateDepartment(id: string): Promise<IDepartment> {
  const activeCount = await Employee.countDocuments({ department: id, status: 'active' });
  if (activeCount > 0) {
    throw ApiError.conflict(`Cannot deactivate: ${activeCount} active employee(s) are still assigned to this department`);
  }

  const department = await Department.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!department) throw ApiError.notFound('Department not found');
  return department;
}

export async function assignManager(id: string, employeeId: string): Promise<IDepartment> {
  const [department, employee] = await Promise.all([Department.findById(id), Employee.findById(employeeId)]);
  if (!department) throw ApiError.notFound('Department not found');
  if (!employee) throw ApiError.notFound('Employee not found');

  if (employee.department && employee.department.toString() !== id) {
    throw ApiError.badRequest('This employee belongs to a different department. Reassign them first.');
  }
  if (!employee.department) {
    employee.department = department._id as Types.ObjectId;
    await employee.save();
  }

  department.manager = employee._id as Types.ObjectId;
  await department.save();
  return department;
}

export async function assignEmployees(id: string, employeeIds: string[]): Promise<{ modifiedCount: number }> {
  const department = await Department.findById(id);
  if (!department) throw ApiError.notFound('Department not found');

  const result = await Employee.updateMany({ _id: { $in: employeeIds } }, { $set: { department: department._id } });
  return { modifiedCount: result.modifiedCount };
}

export async function getDepartmentStats(id: string) {
  const department = await Department.findById(id);
  if (!department) throw ApiError.notFound('Department not found');

  const [totalEmployees, activeEmployees, byEmploymentType] = await Promise.all([
    Employee.countDocuments({ department: id }),
    Employee.countDocuments({ department: id, status: 'active' }),
    Employee.aggregate([
      { $match: { department: department._id } },
      { $group: { _id: '$employmentType', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    department: department.name,
    totalEmployees,
    activeEmployees,
    byEmploymentType: byEmploymentType.map((row) => ({ employmentType: row._id, count: row.count })),
    staffingRequirements: department.staffingRequirements,
  };
}
