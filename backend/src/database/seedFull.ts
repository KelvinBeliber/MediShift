import { connectDB } from '@config/db';
import { logger } from '@utils/logger';
import mongoose from 'mongoose';

import { Department } from '@models/Department.model';
import { Position } from '@models/Position.model';
import { Certification } from '@models/Certification.model';
import { Employee, IEmployee } from '@models/Employee.model';
import { User } from '@models/User.model';
import { Role } from '@models/Role.model';
import { Schedule } from '@models/Schedule.model';
import { Shift } from '@models/Shift.model';
import { ShiftAssignment } from '@models/ShiftAssignment.model';
import { Attendance } from '@models/Attendance.model';
import { LeaveRequest } from '@models/LeaveRequest.model';
import { ShiftSwapRequest } from '@models/ShiftSwapRequest.model';
import { Announcement } from '@models/Announcement.model';
import { Notification } from '@models/Notification.model';
import { Message } from '@models/Message.model';
import { PayrollInput } from '@models/PayrollInput.model';
import { AuditLog } from '@models/AuditLog.model';

import { EmploymentType, EmployeeStatus, ShiftType, LeaveType } from '@constants/enums';
import { ROLES } from '@constants/roles';
import { seedRolesAndPermissions, seedSuperAdmin } from './seed';

const PASSWORD = 'TestPass123!';

// ---------------------------------------------------------------------------
// Reference data (kept across reseeds by other scripts, but defined here too
// so this script works standalone against an empty database).
// ---------------------------------------------------------------------------

interface DepartmentSeed {
  name: string;
  code: string;
  description: string;
}

const DEPARTMENTS: DepartmentSeed[] = [
  { name: 'Emergency Department', code: 'ED', description: 'Emergency and trauma care' },
  { name: 'Intensive Care Unit', code: 'ICU', description: 'Critical care for severely ill patients' },
  { name: 'Surgery', code: 'SURG', description: 'Surgical operations and pre/post-op care' },
  { name: 'Cardiology', code: 'CARD', description: 'Heart and cardiovascular care' },
  { name: 'Pediatrics', code: 'PEDS', description: 'Care for infants, children, and adolescents' },
  { name: 'Obstetrics & Gynecology', code: 'OBGYN', description: "Maternity and women's health" },
  { name: 'Oncology', code: 'ONC', description: 'Cancer diagnosis and treatment' },
  { name: 'Radiology', code: 'RAD', description: 'Diagnostic imaging services' },
  { name: 'Neurology', code: 'NEURO', description: 'Brain and nervous system care' },
  { name: 'Orthopedics', code: 'ORTHO', description: 'Musculoskeletal care' },
  { name: 'Psychiatry', code: 'PSYCH', description: 'Mental health services' },
  { name: 'Pharmacy', code: 'PHARM', description: 'Medication dispensing and management' },
  { name: 'Laboratory', code: 'LAB', description: 'Clinical diagnostic testing' },
  { name: 'Physical Therapy', code: 'PT', description: 'Rehabilitation and physical therapy' },
  { name: 'Anesthesiology', code: 'ANES', description: 'Anesthesia and pain management' },
  { name: 'Administration', code: 'ADMIN', description: 'Hospital administration and operations' },
];

interface PositionSeed {
  title: string;
  salaryRange: { min: number; max: number };
  defaultWorkingHoursPerWeek: number;
}

const POSITIONS: PositionSeed[] = [
  { title: 'Registered Nurse', salaryRange: { min: 65000, max: 95000 }, defaultWorkingHoursPerWeek: 36 },
  { title: 'Charge Nurse', salaryRange: { min: 80000, max: 105000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Nurse Practitioner', salaryRange: { min: 95000, max: 130000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Attending Physician', salaryRange: { min: 180000, max: 320000 }, defaultWorkingHoursPerWeek: 45 },
  { title: 'Resident Physician', salaryRange: { min: 60000, max: 75000 }, defaultWorkingHoursPerWeek: 60 },
  { title: 'Surgeon', salaryRange: { min: 250000, max: 450000 }, defaultWorkingHoursPerWeek: 50 },
  { title: 'Anesthesiologist', salaryRange: { min: 220000, max: 380000 }, defaultWorkingHoursPerWeek: 45 },
  { title: 'Physician Assistant', salaryRange: { min: 90000, max: 120000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Medical Technologist', salaryRange: { min: 50000, max: 72000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Radiology Technician', salaryRange: { min: 48000, max: 70000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Pharmacist', salaryRange: { min: 100000, max: 140000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Pharmacy Technician', salaryRange: { min: 32000, max: 48000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Physical Therapist', salaryRange: { min: 70000, max: 95000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Medical Assistant', salaryRange: { min: 30000, max: 45000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Administrative Coordinator', salaryRange: { min: 38000, max: 55000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Department Manager', salaryRange: { min: 85000, max: 120000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Janitorial Staff', salaryRange: { min: 26000, max: 36000 }, defaultWorkingHoursPerWeek: 40 },
  { title: 'Security Officer', salaryRange: { min: 32000, max: 44000 }, defaultWorkingHoursPerWeek: 40 },
];

interface CertificationSeed {
  name: string;
  code: string;
  issuingBody: string;
  validityPeriodMonths: number;
}

const CERTIFICATIONS: CertificationSeed[] = [
  { name: 'Basic Life Support', code: 'BLS', issuingBody: 'Philippine Red Cross', validityPeriodMonths: 24 },
  { name: 'Advanced Cardiac Life Support', code: 'ACLS', issuingBody: 'Philippine Heart Association', validityPeriodMonths: 24 },
  { name: 'Pediatric Advanced Life Support', code: 'PALS', issuingBody: 'Philippine Pediatric Society', validityPeriodMonths: 24 },
  { name: 'Neonatal Resuscitation Program', code: 'NRP', issuingBody: 'Philippine Society of Newborn Medicine', validityPeriodMonths: 24 },
  { name: 'PRC Nursing License', code: 'RN-PRC', issuingBody: 'Professional Regulation Commission', validityPeriodMonths: 36 },
  { name: 'PRC Physician License', code: 'MD-PRC', issuingBody: 'Professional Regulation Commission', validityPeriodMonths: 36 },
  { name: 'PRC Pharmacist License', code: 'RPH-PRC', issuingBody: 'Professional Regulation Commission', validityPeriodMonths: 36 },
  { name: 'Certified Radiologic Technologist', code: 'CRT', issuingBody: 'Professional Regulation Commission', validityPeriodMonths: 36 },
  { name: 'Infection Control Certification', code: 'ICC', issuingBody: 'Department of Health', validityPeriodMonths: 12 },
  { name: 'First Aid Certification', code: 'FA', issuingBody: 'Philippine Red Cross', validityPeriodMonths: 24 },
];

// ---------------------------------------------------------------------------
// Filipino names
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Juan', 'Maria', 'Jose', 'Ana', 'Antonio', 'Rosa', 'Pedro', 'Carmen', 'Francisco', 'Teresita',
  'Ramon', 'Corazon', 'Eduardo', 'Josefina', 'Ricardo', 'Luzviminda', 'Manuel', 'Remedios', 'Roberto', 'Erlinda',
  'Fernando', 'Imelda', 'Alfredo', 'Leonora', 'Danilo', 'Perla', 'Rodrigo', 'Estrella', 'Rogelio', 'Milagros',
  'Renato', 'Norma', 'Arnel', 'Divina', 'Bayani', 'Aurora', 'Cesar', 'Angelica', 'Dennis', 'Marilou',
  'Edgar', 'Marites', 'Ferdinand', 'Analiza', 'Gerardo', 'Jasmin', 'Herminio', 'Katrina', 'Ignacio', 'Liza',
  'Jaime', 'Michelle', 'Kristian', 'Nenita', 'Leonardo', 'Ofelia', 'Marlon', 'Precious', 'Nestor', 'Queenie',
  'Oscar', 'Rowena', 'Paulo', 'Sheila', 'Quirino', 'Trisha', 'Reynaldo', 'Vilma', 'Salvador', 'Winnie',
  'Teodoro', 'Ximena', 'Ulysses', 'Yolanda', 'Vicente', 'Zenaida', 'Wilfredo', 'Angelina', 'Christian', 'Bea',
  'Dominic', 'Camille', 'Emmanuel', 'Diana', 'Gilbert', 'Ella', 'Harold', 'Faith', 'Ivan', 'Grace',
  'Jerome', 'Honeylet', 'Kristoffer', 'Irish', 'Lorenzo', 'Joy', 'Mark', 'Kimberly', 'Noel', 'Lorraine',
];

const LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Ramos',
  'Gonzales', 'Dela Cruz', 'Villanueva', 'Aquino', 'Castillo', 'Del Rosario', 'Pascual', 'Salazar', 'Fernandez', 'Rivera',
  'Aguilar', 'Domingo', 'Mercado', 'Navarro', 'Rosario', 'Soriano', 'Marquez', 'Valdez', 'Manalo', 'De Guzman',
  'Bernardo', 'Tolentino', 'Gutierrez', 'Peralta', 'Ignacio', 'Aranda', 'Cabrera', 'Roxas', 'Alvarez', 'Lozano',
  'Nolasco', 'Concepcion', 'Angeles', 'Espino', 'Guevara', 'Pangilinan', 'Salonga', 'Villareal', 'Zamora', 'Bonifacio',
  'Corpuz', 'Dizon', 'Estrada', 'Francisco', 'Gatchalian', 'Herrera', 'Ilagan', 'Jimenez', 'Lacson', 'Macapagal',
  'Nepomuceno', 'Ochoa', 'Panganiban', 'Quiambao', 'Robles', 'Sarmiento', 'Tuazon', 'Uy', 'Velasco', 'Yulo',
  'Abad', 'Balagtas', 'Castro', 'Deloso', 'Enriquez', 'Fajardo', 'Galang', 'Hidalgo', 'Isip', 'Javier',
];

const EMPLOYMENT_TYPES: EmploymentType[] = ['full_time', 'full_time', 'full_time', 'part_time', 'contract', 'per_diem'];
const STATUSES: EmployeeStatus[] = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'on_leave', 'inactive'];
const TOTAL_EMPLOYEES = 100;

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function randomDateWithinYears(years: number): Date {
  const now = Date.now();
  const past = now - Math.random() * years * 365 * 24 * 60 * 60 * 1000;
  return new Date(past);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// ---------------------------------------------------------------------------
// Wipe (everything EXCEPT departments, positions, certifications)
// ---------------------------------------------------------------------------

async function wipeTransactionalData(): Promise<void> {
  await Promise.all([
    User.deleteMany({}),
    Employee.deleteMany({}),
    Schedule.deleteMany({}),
    Shift.deleteMany({}),
    ShiftAssignment.deleteMany({}),
    Attendance.deleteMany({}),
    LeaveRequest.deleteMany({}),
    ShiftSwapRequest.deleteMany({}),
    Announcement.deleteMany({}),
    Notification.deleteMany({}),
    Message.deleteMany({}),
    PayrollInput.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  logger.info('Wiped transactional collections (departments, positions, certifications preserved)');
}

// ---------------------------------------------------------------------------
// Reference data seeding (idempotent upserts)
// ---------------------------------------------------------------------------

async function seedDepartments(): Promise<Map<string, mongoose.Types.ObjectId>> {
  const codeToId = new Map<string, mongoose.Types.ObjectId>();
  for (const dept of DEPARTMENTS) {
    const doc = await Department.findOneAndUpdate(
      { code: dept.code },
      { $setOnInsert: dept },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    codeToId.set(dept.code, doc._id as mongoose.Types.ObjectId);
  }
  logger.info(`Ensured ${codeToId.size} departments`);
  return codeToId;
}

async function seedPositions(): Promise<Map<string, mongoose.Types.ObjectId>> {
  const titleToId = new Map<string, mongoose.Types.ObjectId>();
  for (const pos of POSITIONS) {
    const doc = await Position.findOneAndUpdate(
      { title: pos.title },
      { $setOnInsert: pos },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    titleToId.set(pos.title, doc._id as mongoose.Types.ObjectId);
  }
  logger.info(`Ensured ${titleToId.size} positions`);
  return titleToId;
}

async function seedCertifications(): Promise<mongoose.Types.ObjectId[]> {
  const ids: mongoose.Types.ObjectId[] = [];
  for (const cert of CERTIFICATIONS) {
    const doc = await Certification.findOneAndUpdate(
      { code: cert.code },
      { $setOnInsert: cert },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    ids.push(doc._id as mongoose.Types.ObjectId);
  }
  logger.info(`Ensured ${ids.length} certifications`);
  return ids;
}

// ---------------------------------------------------------------------------
// Employees + Users
// ---------------------------------------------------------------------------

interface SeededEmployee {
  employee: IEmployee;
  departmentCode: string;
  userId: mongoose.Types.ObjectId;
  roleName: string;
}

async function seedEmployeesAndUsers(
  departmentIds: Map<string, mongoose.Types.ObjectId>,
  positionIds: Map<string, mongoose.Types.ObjectId>,
  certificationIds: mongoose.Types.ObjectId[]
): Promise<SeededEmployee[]> {
  const departmentCodes = Array.from(departmentIds.keys());
  const positionTitles = Array.from(positionIds.keys());
  const roles = await Role.find({});
  const roleByName = new Map(roles.map((r) => [r.name, r._id as mongoose.Types.ObjectId]));

  const result: SeededEmployee[] = [];
  let counter = 0;

  // Distribute 100 employees across 16 departments (extra employees on the first few depts).
  const base = Math.floor(TOTAL_EMPLOYEES / departmentCodes.length);
  const remainder = TOTAL_EMPLOYEES % departmentCodes.length;

  for (let deptIdx = 0; deptIdx < departmentCodes.length; deptIdx++) {
    const code = departmentCodes[deptIdx];
    const countForDept = base + (deptIdx < remainder ? 1 : 0);

    for (let i = 0; i < countForDept; i++) {
      counter++;
      const firstName = pick(FIRST_NAMES, counter * 7 + i);
      const lastName = pick(LAST_NAMES, counter * 13 + i * 3);
      const employeeId = `EMP${String(counter).padStart(5, '0')}`;
      const email = `${firstName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}.${counter}@medishift.local`;
      const positionTitle = pick(positionTitles, counter + i * 5);

      // Assign a management role to the first two employees in each department;
      // everyone else is a rank-and-file employee.
      let roleName: string = ROLES.EMPLOYEE;
      if (i === 0) roleName = ROLES.DEPARTMENT_HEAD;
      else if (i === 1) roleName = ROLES.SHIFT_COORDINATOR;

      const status = pick(STATUSES, counter * 3 + i);
      const numCerts = 1 + (counter % 3);
      const certs = Array.from({ length: numCerts }, (_, c) => {
        const certId = pick(certificationIds, counter + c * 11);
        const issuedDate = randomDateWithinYears(3);
        return {
          certification: certId,
          issuedDate,
          expiryDate: addDays(issuedDate, 730),
        };
      });

      const employee = await Employee.create({
        employeeId,
        firstName,
        lastName,
        email,
        phone: `09${String(100000000 + (counter * 137) % 899999999).padStart(9, '0')}`,
        address: {
          street: `${100 + counter} Rizal Street`,
          city: pick(['Quezon City', 'Makati', 'Manila', 'Pasig', 'Taguig', 'Cebu City', 'Davao City', 'Cavite'], counter),
          state: pick(['Metro Manila', 'Cebu', 'Davao del Sur', 'Cavite'], counter),
          zip: String(1000 + (counter % 999)),
          country: 'Philippines',
        },
        emergencyContact: {
          name: `${pick(FIRST_NAMES, counter + 3)} ${lastName}`,
          relationship: pick(['Spouse', 'Parent', 'Sibling', 'Child'], counter),
          phone: `09${String(200000000 + (counter * 211) % 799999999).padStart(9, '0')}`,
        },
        department: departmentIds.get(code),
        position: positionIds.get(positionTitle),
        employmentType: pick(EMPLOYMENT_TYPES, counter),
        hireDate: randomDateWithinYears(8),
        salary: 30000 + (counter % 20) * 5000,
        status,
        skills: [],
        certifications: certs,
        medicalLicenseNumber: positionTitle.includes('Physician') || positionTitle === 'Surgeon' || positionTitle === 'Anesthesiologist'
          ? `PRC-${100000 + counter}`
          : undefined,
      });

      const role = roleByName.get(roleName) ?? roleByName.get(ROLES.EMPLOYEE)!;
      const user = await User.create({
        email,
        password: PASSWORD,
        firstName,
        lastName,
        role,
        employee: employee._id,
        isEmailVerified: true,
        isActive: status !== 'terminated',
      });

      employee.user = user._id as mongoose.Types.ObjectId;
      await employee.save();

      result.push({ employee, departmentCode: code, userId: user._id as mongoose.Types.ObjectId, roleName });
    }
  }

  logger.info(`Seeded ${result.length} employees with linked user accounts`);
  return result;
}

async function seedHospitalAdminAndHr(): Promise<{ hospitalAdminUserId: mongoose.Types.ObjectId; hrManagerUserId: mongoose.Types.ObjectId }> {
  const hospitalAdminRole = await Role.findOne({ name: ROLES.HOSPITAL_ADMIN });
  const hrManagerRole = await Role.findOne({ name: ROLES.HR_MANAGER });

  const hospitalAdmin = await User.create({
    email: 'hospital.admin@medishift.local',
    password: PASSWORD,
    firstName: 'Hospital',
    lastName: 'Admin',
    role: hospitalAdminRole!._id,
    isEmailVerified: true,
    isActive: true,
  });

  const hrManager = await User.create({
    email: 'hr.manager@medishift.local',
    password: PASSWORD,
    firstName: 'HR',
    lastName: 'Manager',
    role: hrManagerRole!._id,
    isEmailVerified: true,
    isActive: true,
  });

  logger.info(`Seeded hospital admin (${hospitalAdmin.email}) and HR manager (${hrManager.email}) — password: ${PASSWORD}`);
  return { hospitalAdminUserId: hospitalAdmin._id as mongoose.Types.ObjectId, hrManagerUserId: hrManager._id as mongoose.Types.ObjectId };
}

// ---------------------------------------------------------------------------
// Schedules, Shifts, Shift Assignments, Attendance
// ---------------------------------------------------------------------------

const SHIFT_TIMES: Record<string, { start: string; end: string }> = {
  morning: { start: '07:00', end: '15:00' },
  afternoon: { start: '15:00', end: '23:00' },
  night: { start: '23:00', end: '07:00' },
};
const SHIFT_TYPES_ROTATION: ShiftType[] = ['morning', 'afternoon', 'night'];

interface DeptSchedulingContext {
  scheduleId: mongoose.Types.ObjectId;
  shiftsByDate: Map<string, mongoose.Types.ObjectId>;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function seedSchedulesShiftsAttendance(
  employeesByDept: Map<string, SeededEmployee[]>,
  departmentIds: Map<string, mongoose.Types.ObjectId>,
  generatedBy: mongoose.Types.ObjectId
): Promise<Map<string, mongoose.Types.ObjectId>> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = addDays(today, -30);
  const rangeEnd = addDays(today, 14);

  const allShiftIds: mongoose.Types.ObjectId[] = [];
  const shiftMetaById = new Map<string, { employees: mongoose.Types.ObjectId[]; date: Date }>();

  for (const [code, deptId] of departmentIds) {
    const employees = employeesByDept.get(code) ?? [];
    if (employees.length === 0) continue;

    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const schedule = await Schedule.create({
      department: deptId,
      month: today.getMonth() + 1,
      year: today.getFullYear(),
      startDate,
      endDate,
      status: 'published',
      generatedBy,
      publishedBy: generatedBy,
      publishedAt: addDays(today, -20),
      notes: 'Auto-generated demo schedule',
    });

    let cursor = new Date(rangeStart);
    let dayCounter = 0;
    while (cursor <= rangeEnd) {
      const shiftType = pick(SHIFT_TYPES_ROTATION, dayCounter);
      const times = SHIFT_TIMES[shiftType];
      const requiredStaff = Math.max(1, Math.ceil(employees.length / 3));

      const shift = await Shift.create({
        schedule: schedule._id,
        department: deptId,
        date: new Date(cursor),
        shiftType,
        startTime: times.start,
        endTime: times.end,
        requiredStaff,
      });

      // Rotate which third of the department works this shift.
      const groupIndex = dayCounter % 3;
      const groupSize = Math.ceil(employees.length / 3);
      const groupEmployees = employees.slice(groupIndex * groupSize, groupIndex * groupSize + groupSize);
      const assignedEmployeeIds: mongoose.Types.ObjectId[] = [];

      for (const emp of groupEmployees) {
        const status = cursor < today ? pick(['completed', 'completed', 'completed', 'no_show'], dayCounter + Number(emp.employee.employeeId.slice(-2))) : 'assigned';
        await ShiftAssignment.create({
          shift: shift._id,
          employee: emp.employee._id,
          status,
          assignedBy: generatedBy,
          isAiGenerated: true,
          confirmedAt: cursor < today ? addDays(cursor, -1) : undefined,
        });
        assignedEmployeeIds.push(emp.employee._id as mongoose.Types.ObjectId);
      }

      allShiftIds.push(shift._id as mongoose.Types.ObjectId);
      shiftMetaById.set(String(shift._id), { employees: assignedEmployeeIds, date: new Date(cursor) });

      cursor = addDays(cursor, 1);
      dayCounter++;
    }
  }

  // Build attendance for past shifts based on assignments (clock-in/clock-out already recorded).
  let attendanceCount = 0;
  for (const [shiftId, meta] of shiftMetaById) {
    if (meta.date >= today) continue; // future shifts have no attendance yet

    for (const employeeId of meta.employees) {
      const rand = Math.random();
      let status: 'present' | 'late' | 'absent' | 'overtime' = 'present';
      if (rand < 0.05) status = 'absent';
      else if (rand < 0.15) status = 'late';
      else if (rand < 0.2) status = 'overtime';

      if (status === 'absent') {
        await Attendance.create({
          employee: employeeId,
          shift: shiftId,
          date: meta.date,
          status: 'absent',
          breaks: [],
        });
        attendanceCount++;
        continue;
      }

      const lateMinutes = status === 'late' ? 10 + Math.floor(Math.random() * 30) : 0;
      const clockInBase = new Date(meta.date);
      clockInBase.setHours(7, lateMinutes, 0, 0);
      const overtimeHours = status === 'overtime' ? 1 + Math.floor(Math.random() * 3) : 0;
      const clockOutBase = new Date(meta.date);
      clockOutBase.setHours(15 + overtimeHours, 0, 0, 0);

      const breakStart = new Date(meta.date);
      breakStart.setHours(11, 0, 0, 0);
      const breakEnd = new Date(meta.date);
      breakEnd.setHours(11, 30, 0, 0);

      await Attendance.create({
        employee: employeeId,
        shift: shiftId,
        date: meta.date,
        clockIn: { time: clockInBase, method: pick(['manual', 'gps', 'qr'], attendanceCount) },
        clockOut: { time: clockOutBase, method: pick(['manual', 'gps', 'qr'], attendanceCount + 1) },
        breaks: [{ start: breakStart, end: breakEnd }],
        status,
        totalHoursWorked: 8 + overtimeHours - (lateMinutes / 60),
        overtimeHours,
      });
      attendanceCount++;
    }
  }

  logger.info(`Seeded schedules/shifts across ${departmentIds.size} departments and ${attendanceCount} attendance records`);

  const shiftIndex = new Map<string, mongoose.Types.ObjectId>();
  for (const id of allShiftIds) shiftIndex.set(String(id), id);
  return shiftIndex;
}

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

const LEAVE_TYPES: LeaveType[] = ['vacation', 'sick', 'emergency', 'maternity', 'paternity', 'bereavement', 'study'];

async function seedLeaveRequests(allEmployees: SeededEmployee[], hrManagerUserId: mongoose.Types.ObjectId): Promise<void> {
  const today = new Date();
  let count = 0;

  for (let i = 0; i < allEmployees.length; i++) {
    if (i % 4 !== 0) continue; // ~25% of employees have a leave request
    const emp = allEmployees[i];
    const leaveType = pick(LEAVE_TYPES, i);
    const startOffset = -20 + (i % 40);
    const startDate = addDays(today, startOffset);
    const totalDays = 1 + (i % 5);
    const endDate = addDays(startDate, totalDays - 1);

    const statusRoll = i % 5;
    let status: 'pending' | 'department_approved' | 'approved' | 'rejected' | 'cancelled';
    if (statusRoll === 0) status = 'pending';
    else if (statusRoll === 1) status = 'department_approved';
    else if (statusRoll === 2) status = 'rejected';
    else if (statusRoll === 3) status = 'cancelled';
    else status = 'approved';

    await LeaveRequest.create({
      employee: emp.employee._id,
      leaveType,
      startDate,
      endDate,
      totalDays,
      reason: `${leaveType} leave request`,
      status,
      departmentApproval: status === 'pending' ? undefined : { approvedBy: hrManagerUserId, approvedAt: addDays(startDate, -2), comment: 'Approved by department head' },
      hrApproval: status === 'approved' ? { approvedBy: hrManagerUserId, approvedAt: addDays(startDate, -1), comment: 'Approved by HR' } : undefined,
      rejectionReason: status === 'rejected' ? 'Insufficient staffing coverage during requested period' : undefined,
    });
    count++;
  }

  logger.info(`Seeded ${count} leave requests`);
}

// ---------------------------------------------------------------------------
// Shift swap requests
// ---------------------------------------------------------------------------

async function seedShiftSwaps(
  employeesByDept: Map<string, SeededEmployee[]>,
  hrManagerUserId: mongoose.Types.ObjectId
): Promise<void> {
  let count = 0;

  for (const [, employees] of employeesByDept) {
    if (employees.length < 2) continue;

    for (let i = 0; i < employees.length; i += 6) {
      const requester = employees[i];
      const target = employees[(i + 1) % employees.length];
      if (String(requester.employee._id) === String(target.employee._id)) continue;

      const requestingShift = await Shift.findOne({ department: requester.employee.department }).sort({ date: -1 }).skip(i % 5);
      const targetShift = await Shift.findOne({ department: target.employee.department }).sort({ date: -1 }).skip((i + 2) % 5);
      if (!requestingShift || !targetShift) continue;

      const statusRoll = count % 5;
      let status: 'pending' | 'accepted' | 'manager_approved' | 'rejected' | 'cancelled';
      if (statusRoll === 0) status = 'pending';
      else if (statusRoll === 1) status = 'accepted';
      else if (statusRoll === 2) status = 'rejected';
      else if (statusRoll === 3) status = 'cancelled';
      else status = 'manager_approved';

      await ShiftSwapRequest.create({
        requestingEmployee: requester.employee._id,
        requestingShift: requestingShift._id,
        targetEmployee: target.employee._id,
        targetShift: targetShift._id,
        status,
        reason: 'Personal scheduling conflict',
        acceptedAt: status === 'accepted' || status === 'manager_approved' ? new Date() : undefined,
        approvedBy: status === 'manager_approved' ? hrManagerUserId : undefined,
        approvedAt: status === 'manager_approved' ? new Date() : undefined,
        rejectionReason: status === 'rejected' ? 'Target employee already at max shifts this week' : undefined,
      });
      count++;
    }
  }

  logger.info(`Seeded ${count} shift swap requests`);
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

async function seedAnnouncements(
  hospitalAdminUserId: mongoose.Types.ObjectId,
  departmentIds: Map<string, mongoose.Types.ObjectId>
): Promise<void> {
  const hospitalWide = [
    { title: 'Bagong Patakaran sa Uniform', body: 'Simula sa susunod na buwan, mandatory na ang pagsusuot ng bagong hospital ID lace at scrubs na naaayon sa department color code.', priority: 'normal' as const },
    { title: 'Annual Flu Vaccination Drive', body: 'Libreng flu vaccine para sa lahat ng empleyado sa Employee Health Clinic simula Agosto 15 hanggang Agosto 30.', priority: 'important' as const },
    { title: 'Fire Drill Schedule', body: 'Magkakaroon ng fire drill sa buong ospital sa susunod na Biyernes, 10:00 AM. Lahat ng staff ay inaasahang lumahok.', priority: 'important' as const },
    { title: 'Emergency: Water Supply Interruption', body: 'May emergency water interruption sa buong facility mula 10PM hanggang 4AM. Mangyaring maghanda ng sapat na tubig sa inyong mga department.', priority: 'emergency' as const },
    { title: 'New HRIS Self-Service Portal', body: 'Available na ang bagong MediShift self-service portal para sa payslips, leave filing, at schedule viewing.', priority: 'normal' as const },
  ];

  for (const a of hospitalWide) {
    await Announcement.create({
      title: a.title,
      body: a.body,
      scope: 'hospital',
      priority: a.priority,
      author: hospitalAdminUserId,
      publishedAt: randomDateWithinYears(0.3),
      isActive: true,
    });
  }

  const deptMessages = [
    'Paalala: Isumite ang inyong monthly inventory report bago mag-Biyernes.',
    'May staff meeting sa susunod na Lunes, 8:00 AM sa conference room.',
    'Salamat sa mahusay na performance ngayong buwan, patuloy nating pagbutihin ang patient care.',
    'Bagong protocol para sa PPE usage, pakibasa ang na-post na memo sa bulletin board.',
  ];

  let i = 0;
  for (const [, deptId] of departmentIds) {
    await Announcement.create({
      title: `Department Update — ${i + 1}`,
      body: pick(deptMessages, i),
      scope: 'department',
      department: deptId,
      priority: pick(['normal', 'important'], i),
      author: hospitalAdminUserId,
      publishedAt: randomDateWithinYears(0.2),
      isActive: true,
    });
    i++;
  }

  logger.info(`Seeded ${hospitalWide.length + departmentIds.size} announcements`);
}

// ---------------------------------------------------------------------------
// Payroll inputs
// ---------------------------------------------------------------------------

async function seedPayroll(allEmployees: SeededEmployee[], generatedBy: mongoose.Types.ObjectId): Promise<void> {
  const today = new Date();
  const periods = [
    { start: addDays(today, -44), end: addDays(today, -30), status: 'exported' as const },
    { start: addDays(today, -29), end: addDays(today, -15), status: 'finalized' as const },
    { start: addDays(today, -14), end: today, status: 'draft' as const },
  ];

  let count = 0;
  for (const period of periods) {
    for (let i = 0; i < allEmployees.length; i++) {
      const emp = allEmployees[i];
      const regularHours = 70 + (i % 15);
      const overtimeHours = i % 7 === 0 ? 4 + (i % 6) : 0;
      const nightDiff = i % 3 === 0 ? 8 + (i % 10) : 0;
      const holidayHours = i % 10 === 0 ? 8 : 0;
      const tardiness = i % 5 === 0 ? 15 + (i % 30) : 0;
      const undertime = i % 8 === 0 ? 20 + (i % 20) : 0;
      const absences = i % 12 === 0 ? 1 : 0;

      await PayrollInput.create({
        employee: emp.employee._id,
        periodStart: period.start,
        periodEnd: period.end,
        totalHoursWorked: regularHours + overtimeHours,
        regularHours,
        overtimeHours,
        nightDifferentialHours: nightDiff,
        holidayHours,
        tardinessMinutes: tardiness,
        undertimeMinutes: undertime,
        absences,
        status: period.status,
        generatedBy,
        notes: period.status === 'draft' ? 'Pending finalization' : undefined,
      });
      count++;
    }
  }

  logger.info(`Seeded ${count} payroll input records across ${periods.length} pay periods`);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

async function seedNotifications(allEmployees: SeededEmployee[]): Promise<void> {
  let count = 0;
  for (let i = 0; i < allEmployees.length; i += 3) {
    const emp = allEmployees[i];
    await Notification.create({
      recipient: emp.userId,
      type: pick(['schedule_published', 'leave_approved', 'announcement', 'shift_reminder'], i),
      title: 'Bagong Schedule Available',
      message: 'Na-publish na ang inyong schedule para sa susunod na buwan. I-check ang MediShift app.',
      channels: ['in_app'],
      isRead: i % 2 === 0,
      readAt: i % 2 === 0 ? new Date() : undefined,
    });
    count++;
  }
  logger.info(`Seeded ${count} notifications`);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  await connectDB();

  logger.info('Wiping transactional data (departments, positions, certifications preserved)...');
  await wipeTransactionalData();

  await seedRolesAndPermissions();
  await seedSuperAdmin();

  const departmentIds = await seedDepartments();
  const positionIds = await seedPositions();
  const certificationIds = await seedCertifications();

  const { hospitalAdminUserId, hrManagerUserId } = await seedHospitalAdminAndHr();

  const allEmployees = await seedEmployeesAndUsers(departmentIds, positionIds, certificationIds);

  const employeesByDept = new Map<string, SeededEmployee[]>();
  for (const e of allEmployees) {
    const list = employeesByDept.get(e.departmentCode) ?? [];
    list.push(e);
    employeesByDept.set(e.departmentCode, list);
  }

  await seedSchedulesShiftsAttendance(employeesByDept, departmentIds, hrManagerUserId);
  await seedLeaveRequests(allEmployees, hrManagerUserId);
  await seedShiftSwaps(employeesByDept, hrManagerUserId);
  await seedAnnouncements(hospitalAdminUserId, departmentIds);
  await seedPayroll(allEmployees, hrManagerUserId);
  await seedNotifications(allEmployees);

  await mongoose.disconnect();
  logger.info('Full seed complete');
  logger.info(`Login as any employee: <firstname>.<lastname>.<n>@medishift.local / ${PASSWORD}`);
  logger.info(`Hospital admin: hospital.admin@medishift.local / ${PASSWORD}`);
  logger.info(`HR manager: hr.manager@medishift.local / ${PASSWORD}`);
  process.exit(0);
}

if (require.main === module) {
  run().catch((error) => {
    logger.error('Full seed failed', error);
    process.exit(1);
  });
}
