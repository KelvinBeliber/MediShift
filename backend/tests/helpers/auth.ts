import { Types } from 'mongoose';
import { User, IUser } from '../../src/models/User.model';
import { Role } from '../../src/models/Role.model';
import { Employee, IEmployee } from '../../src/models/Employee.model';
import { signAccessToken } from '../../src/utils/jwt';
import { RoleName } from '../../src/constants/roles';
import { makeEmployee } from './factories';

let counter = 0;

interface CreateUserOptions {
  email?: string;
  employee?: Types.ObjectId | string;
  isActive?: boolean;
  isEmailVerified?: boolean;
}

export interface TestUser {
  user: IUser;
  accessToken: string;
}

export async function createUserWithRole(roleName: RoleName, options: CreateUserOptions = {}): Promise<TestUser> {
  counter += 1;
  const role = await Role.findOne({ name: roleName });
  if (!role) {
    throw new Error(`Role "${roleName}" is not seeded — check tests/globalSetup.ts`);
  }

  const email = options.email ?? `${roleName}.${counter}@test.medishift.local`;

  const user = await User.create({
    email,
    password: 'Password123!',
    role: role._id,
    employee: options.employee,
    isEmailVerified: options.isEmailVerified ?? true,
    isActive: options.isActive ?? true,
  });

  const accessToken = signAccessToken({ sub: user.id, role: roleName });

  return { user, accessToken };
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export interface LinkedEmployeeUser extends TestUser {
  employee: IEmployee;
}

/** Creates an Employee with a linked, logged-in User account (bidirectional link). */
export async function makeLinkedEmployeeUser(
  employeeOverrides: Partial<IEmployee> = {},
  roleName: RoleName = 'employee'
): Promise<LinkedEmployeeUser> {
  const employee = await makeEmployee(employeeOverrides);
  const { user, accessToken } = await createUserWithRole(roleName, { employee: employee._id as Types.ObjectId });
  await Employee.findByIdAndUpdate(employee._id, { user: user._id });
  return { employee, user, accessToken };
}
