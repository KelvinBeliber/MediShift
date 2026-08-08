import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import { PAYROLL_STATUS, PayrollStatus } from '@constants/enums';

export interface IPayrollInput extends Document {
  employee: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  totalHoursWorked: number;
  regularHours: number;
  overtimeHours: number;
  nightDifferentialHours: number;
  holidayHours: number;
  tardinessMinutes: number;
  undertimeMinutes: number;
  absences: number;
  status: PayrollStatus;
  generatedBy?: Types.ObjectId;
  notes?: string;
}

const payrollInputSchema = new Schema<IPayrollInput>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    totalHoursWorked: { type: Number, default: 0, min: 0 },
    regularHours: { type: Number, default: 0, min: 0 },
    overtimeHours: { type: Number, default: 0, min: 0 },
    nightDifferentialHours: { type: Number, default: 0, min: 0 },
    holidayHours: { type: Number, default: 0, min: 0 },
    tardinessMinutes: { type: Number, default: 0, min: 0 },
    undertimeMinutes: { type: Number, default: 0, min: 0 },
    absences: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: PAYROLL_STATUS, default: 'draft' },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
  },
  schemaOptions
);

payrollInputSchema.index({ employee: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

export const PayrollInput = model<IPayrollInput>('PayrollInput', payrollInputSchema);
