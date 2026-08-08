import { z } from 'zod';
import { EMPLOYMENT_TYPE, EMPLOYEE_STATUS } from '@constants/enums';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'Invalid ID format');

const addressSchema = z
  .object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  })
  .partial();

const emergencyContactSchema = z
  .object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    phone: z.string().optional(),
  })
  .partial();

const employeeCertificationSchema = z.object({
  certification: objectId,
  issuedDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  documentUrl: z.string().url().optional(),
});

export const createEmployeeSchema = z.object({
  employeeId: z.string().trim().optional(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().optional(),
  photo: z.string().url().optional(),
  address: addressSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
  department: objectId.optional(),
  position: objectId.optional(),
  employmentType: z.enum(EMPLOYMENT_TYPE),
  hireDate: z.coerce.date(),
  salary: z.coerce.number().min(0).optional(),
  status: z.enum(EMPLOYEE_STATUS).optional(),
  skills: z.array(z.string()).optional(),
  certifications: z.array(employeeCertificationSchema).optional(),
  medicalLicenseNumber: z.string().trim().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ employeeId: true });

// A deliberately narrow subset of fields an employee may edit on their own
// record — no department/position/status/salary/employmentType/hireDate.
export const updateOwnProfileSchema = z
  .object({
    phone: z.string().trim().optional(),
    photo: z.string().url().optional(),
    address: addressSchema.optional(),
    emergencyContact: emergencyContactSchema.optional(),
  })
  .strict();

export const employeeIdParamSchema = z.object({
  id: objectId,
});

export const employeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  search: z.string().optional(),
  department: objectId.optional(),
  position: objectId.optional(),
  status: z.enum(EMPLOYEE_STATUS).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPE).optional(),
});
