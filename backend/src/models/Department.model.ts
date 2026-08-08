import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import { SHIFT_TYPE, ShiftType } from '@constants/enums';

interface IStaffingRequirement {
  shiftType: ShiftType;
  minStaff: number;
  requiredCertifications: Types.ObjectId[];
}

export interface IDepartment extends Document {
  name: string;
  code: string;
  description?: string;
  manager?: Types.ObjectId;
  staffingRequirements: IStaffingRequirement[];
  isActive: boolean;
}

const staffingRequirementSchema = new Schema<IStaffingRequirement>(
  {
    shiftType: { type: String, enum: SHIFT_TYPE, required: true },
    minStaff: { type: Number, required: true, min: 0 },
    requiredCertifications: [{ type: Schema.Types.ObjectId, ref: 'Certification' }],
  },
  { _id: false }
);

const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    manager: { type: Schema.Types.ObjectId, ref: 'Employee' },
    staffingRequirements: { type: [staffingRequirementSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  schemaOptions
);

departmentSchema.virtual('employees', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'department',
});

export const Department = model<IDepartment>('Department', departmentSchema);
