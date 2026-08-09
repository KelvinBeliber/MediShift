import { FilterQuery } from 'mongoose';
import { Employee, IEmployee } from '@models/Employee.model';

export interface EmployeeSearchOptions {
  search?: string;
  department?: string;
  position?: string;
  status?: string;
  employmentType?: string;
  skip: number;
  limit: number;
  sort: Record<string, 1 | -1>;
}

const POPULATE_FIELDS = ['department', 'position', 'certifications.certification'];

function buildFilter(options: EmployeeSearchOptions): FilterQuery<IEmployee> {
  const filter: FilterQuery<IEmployee> = {};

  if (options.search) {
    filter.$text = { $search: options.search };
  }
  if (options.department) filter.department = options.department;
  if (options.position) filter.position = options.position;
  if (options.status) filter.status = options.status;
  if (options.employmentType) filter.employmentType = options.employmentType;

  return filter;
}

export async function search(options: EmployeeSearchOptions): Promise<{ docs: IEmployee[]; total: number }> {
  const filter = buildFilter(options);

  const [docs, total] = await Promise.all([
    Employee.find(filter)
      .populate('department', 'name code')
      .populate('position', 'title')
      .sort(options.sort)
      .skip(options.skip)
      .limit(options.limit),
    Employee.countDocuments(filter),
  ]);

  return { docs, total };
}

export function findById(id: string, includeSalary = false) {
  const query = Employee.findById(id);
  if (includeSalary) query.select('+salary');
  return query
    .populate('department', 'name code')
    .populate('position', 'title')
    .populate('certifications.certification', 'name code');
}

export function findByEmployeeId(employeeId: string) {
  return Employee.findOne({ employeeId: employeeId.toUpperCase() });
}

export function findByEmail(email: string) {
  return Employee.findOne({ email: email.toLowerCase() });
}

export function create(data: Partial<IEmployee>) {
  return Employee.create(data);
}

export function updateById(id: string, data: Partial<IEmployee>, includeSalary = false) {
  const query = Employee.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (includeSalary) query.select('+salary');
  return query.populate('department', 'name code').populate('position', 'title');
}

export function countByDepartment(departmentId: string) {
  return Employee.countDocuments({ department: departmentId, status: 'active' });
}

/**
 * Name/department only, for the messaging "pick a colleague" picker — no
 * address, phone, emergency contact, or other HR fields. Intentionally not
 * gated by employee:view, so it must never select more than this.
 */
export function searchDirectory() {
  return Employee.find({ status: 'active', user: { $ne: null } })
    .select('firstName lastName user department position')
    .populate('department', 'name')
    .populate('position', 'title')
    .sort({ firstName: 1, lastName: 1 })
    .limit(500);
}

export { POPULATE_FIELDS };
