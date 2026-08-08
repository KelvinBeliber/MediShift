import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import { EMPLOYMENT_TYPE, EmploymentType, EMPLOYEE_STATUS, EmployeeStatus } from '@constants/enums';

interface IAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

interface IEmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
}

interface IEmployeeCertification {
  certification: Types.ObjectId;
  issuedDate?: Date;
  expiryDate?: Date;
  documentUrl?: string;
}

export interface IEmployee extends Document {
  employeeId: string;
  user?: Types.ObjectId;
  firstName: string;
  lastName: string;
  photo?: string;
  email: string;
  phone?: string;
  address?: IAddress;
  emergencyContact?: IEmergencyContact;
  department?: Types.ObjectId;
  position?: Types.ObjectId;
  employmentType: EmploymentType;
  hireDate: Date;
  salary?: number;
  status: EmployeeStatus;
  skills: string[];
  certifications: IEmployeeCertification[];
  medicalLicenseNumber?: string;
  documents: Types.ObjectId[];
  fullName?: string;
}

const addressSchema = new Schema<IAddress>(
  {
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String,
  },
  { _id: false }
);

const emergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: String,
    relationship: String,
    phone: String,
  },
  { _id: false }
);

const employeeCertificationSchema = new Schema<IEmployeeCertification>(
  {
    certification: { type: Schema.Types.ObjectId, ref: 'Certification', required: true },
    issuedDate: Date,
    expiryDate: Date,
    documentUrl: String,
  },
  { _id: false }
);

const employeeSchema = new Schema<IEmployee>(
  {
    employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    photo: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: addressSchema,
    emergencyContact: emergencyContactSchema,
    department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    position: { type: Schema.Types.ObjectId, ref: 'Position', index: true },
    employmentType: { type: String, enum: EMPLOYMENT_TYPE, required: true },
    hireDate: { type: Date, required: true },
    salary: { type: Number, min: 0, select: false },
    status: { type: String, enum: EMPLOYEE_STATUS, default: 'active', index: true },
    skills: [{ type: String, trim: true }],
    certifications: { type: [employeeCertificationSchema], default: [] },
    medicalLicenseNumber: { type: String, trim: true },
    documents: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
  },
  schemaOptions
);

employeeSchema.virtual('fullName').get(function getFullName(this: IEmployee) {
  return `${this.firstName} ${this.lastName}`;
});

employeeSchema.index({ firstName: 'text', lastName: 'text', email: 'text', employeeId: 'text' });

export const Employee = model<IEmployee>('Employee', employeeSchema);
