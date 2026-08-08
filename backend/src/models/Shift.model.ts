import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import { SHIFT_TYPE, ShiftType } from '@constants/enums';

export interface IShift extends Document {
  schedule: Types.ObjectId;
  department: Types.ObjectId;
  date: Date;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  requiredStaff: number;
  requiredCertifications: Types.ObjectId[];
  notes?: string;
}

const shiftSchema = new Schema<IShift>(
  {
    schedule: { type: Schema.Types.ObjectId, ref: 'Schedule', required: true, index: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    date: { type: Date, required: true, index: true },
    shiftType: { type: String, enum: SHIFT_TYPE, required: true },
    startTime: { type: String, required: true }, // "HH:mm" 24h
    endTime: { type: String, required: true }, // "HH:mm" 24h
    requiredStaff: { type: Number, required: true, min: 0 },
    requiredCertifications: [{ type: Schema.Types.ObjectId, ref: 'Certification' }],
    notes: { type: String },
  },
  schemaOptions
);

shiftSchema.index({ department: 1, date: 1, shiftType: 1 });

shiftSchema.virtual('assignments', {
  ref: 'ShiftAssignment',
  localField: '_id',
  foreignField: 'shift',
});

export const Shift = model<IShift>('Shift', shiftSchema);
