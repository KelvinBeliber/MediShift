import { Department } from '@models/Department.model';
import { Position } from '@models/Position.model';
import { Employee } from '@models/Employee.model';
import { EmploymentType, EmployeeStatus } from '@constants/enums';
import { logger } from '@utils/logger';
import { connectDB } from '@config/db';
import mongoose from 'mongoose';

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
  { name: 'Obstetrics & Gynecology', code: 'OBGYN', description: 'Maternity and women\'s health' },
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

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth',
  'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Timothy', 'Deborah',
  'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
  'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna',
  'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
  'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Gregory', 'Christine', 'Alexander', 'Debra', 'Frank', 'Rachel',
  'Raymond', 'Carolyn', 'Jack', 'Janet', 'Dennis', 'Maria', 'Jerry', 'Heather', 'Tyler', 'Diane',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
];

const EMPLOYMENT_TYPES: EmploymentType[] = ['full_time', 'full_time', 'full_time', 'part_time', 'contract', 'per_diem'];
const STATUSES: EmployeeStatus[] = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'on_leave', 'inactive'];

const EMPLOYEES_PER_DEPARTMENT = 15;

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function randomDateWithinYears(years: number): Date {
  const now = Date.now();
  const past = now - Math.random() * years * 365 * 24 * 60 * 60 * 1000;
  return new Date(past);
}

export async function seedDepartments(): Promise<Map<string, mongoose.Types.ObjectId>> {
  const codeToId = new Map<string, mongoose.Types.ObjectId>();

  for (const dept of DEPARTMENTS) {
    const doc = await Department.findOneAndUpdate(
      { code: dept.code },
      { $setOnInsert: dept },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    codeToId.set(dept.code, doc._id as mongoose.Types.ObjectId);
  }

  logger.info(`Seeded ${codeToId.size} departments`);
  return codeToId;
}

export async function seedPositions(): Promise<Map<string, mongoose.Types.ObjectId>> {
  const titleToId = new Map<string, mongoose.Types.ObjectId>();

  for (const pos of POSITIONS) {
    const doc = await Position.findOneAndUpdate(
      { title: pos.title },
      { $setOnInsert: pos },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    titleToId.set(pos.title, doc._id as mongoose.Types.ObjectId);
  }

  logger.info(`Seeded ${titleToId.size} positions`);
  return titleToId;
}

export async function seedEmployees(
  departmentIds: Map<string, mongoose.Types.ObjectId>,
  positionIds: Map<string, mongoose.Types.ObjectId>
): Promise<void> {
  const departmentCodes = Array.from(departmentIds.keys());
  const positionTitles = Array.from(positionIds.keys());

  let counter = 0;
  let created = 0;

  for (const code of departmentCodes) {
    for (let i = 0; i < EMPLOYEES_PER_DEPARTMENT; i++) {
      counter++;
      const firstName = pick(FIRST_NAMES, counter * 7 + i);
      const lastName = pick(LAST_NAMES, counter * 13 + i * 3);
      const employeeId = `EMP${String(counter).padStart(5, '0')}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${counter}@medishift.local`;
      const positionTitle = pick(positionTitles, counter + i * 5);

      const existing = await Employee.findOne({ employeeId });
      if (existing) continue;

      await Employee.create({
        employeeId,
        firstName,
        lastName,
        email,
        phone: `555-${String(1000 + (counter % 8999)).padStart(4, '0')}`,
        department: departmentIds.get(code),
        position: positionIds.get(positionTitle),
        employmentType: pick(EMPLOYMENT_TYPES, counter),
        hireDate: randomDateWithinYears(8),
        status: pick(STATUSES, counter * 3 + i),
        skills: [],
        certifications: [],
      });
      created++;
    }
  }

  logger.info(`Seeded ${created} employees across ${departmentCodes.length} departments`);
}

export async function seedDemoData(): Promise<void> {
  const departmentIds = await seedDepartments();
  const positionIds = await seedPositions();
  await seedEmployees(departmentIds, positionIds);
}

async function run(): Promise<void> {
  await connectDB();
  await seedDemoData();
  await mongoose.disconnect();
  logger.info('Demo data seed complete');
  process.exit(0);
}

if (require.main === module) {
  run().catch((error) => {
    logger.error('Demo data seed failed', error);
    process.exit(1);
  });
}
