import { Department, IDepartment } from '../../src/models/Department.model';
import { Position, IPosition } from '../../src/models/Position.model';
import { Certification, ICertification } from '../../src/models/Certification.model';
import { Employee, IEmployee } from '../../src/models/Employee.model';
import { Schedule, ISchedule } from '../../src/models/Schedule.model';
import { Shift, IShift } from '../../src/models/Shift.model';
import { ShiftAssignment, IShiftAssignment } from '../../src/models/ShiftAssignment.model';

let seq = 0;
function next(): number {
  seq += 1;
  return seq;
}

export async function makeDepartment(overrides: Partial<IDepartment> = {}): Promise<IDepartment> {
  const n = next();
  return Department.create({
    name: overrides.name ?? `Test Department ${n}`,
    code: overrides.code ?? `TD${n}`,
    staffingRequirements: [],
    ...overrides,
  });
}

export async function makePosition(overrides: Partial<IPosition> = {}): Promise<IPosition> {
  const n = next();
  return Position.create({
    title: overrides.title ?? `Test Position ${n}`,
    defaultWorkingHoursPerWeek: 40,
    ...overrides,
  });
}

export async function makeCertification(overrides: Partial<ICertification> = {}): Promise<ICertification> {
  const n = next();
  return Certification.create({
    name: overrides.name ?? `Test Cert ${n}`,
    code: overrides.code ?? `CERT${n}`,
    ...overrides,
  });
}

export async function makeEmployee(overrides: Partial<IEmployee> = {}): Promise<IEmployee> {
  const n = next();
  return Employee.create({
    employeeId: overrides.employeeId ?? `EMP-TEST-${n}`,
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? `Employee${n}`,
    email: overrides.email ?? `employee${n}@test.medishift.local`,
    employmentType: overrides.employmentType ?? 'full_time',
    hireDate: overrides.hireDate ?? new Date('2024-01-01'),
    status: overrides.status ?? 'active',
    certifications: overrides.certifications ?? [],
    ...overrides,
  });
}

export async function makeSchedule(overrides: Partial<ISchedule> & { department: string }): Promise<ISchedule> {
  const month = overrides.month ?? 6;
  const year = overrides.year ?? 2030;
  const defaults = {
    month,
    year,
    startDate: new Date(Date.UTC(year, month - 1, 1)),
    endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
    status: 'draft' as const,
  };
  return Schedule.create({ ...defaults, ...overrides });
}

export async function makeShift(
  overrides: Partial<IShift> & { schedule: string; department: string }
): Promise<IShift> {
  const defaults = {
    date: new Date('2030-06-05'),
    shiftType: 'morning' as const,
    startTime: '07:00',
    endTime: '15:00',
    requiredStaff: 1,
    requiredCertifications: [],
  };
  return Shift.create({ ...defaults, ...overrides });
}

export async function makeAssignment(
  overrides: Partial<IShiftAssignment> & { shift: string; employee: string }
): Promise<IShiftAssignment> {
  return ShiftAssignment.create({
    status: 'assigned',
    isAiGenerated: false,
    ...overrides,
  });
}
