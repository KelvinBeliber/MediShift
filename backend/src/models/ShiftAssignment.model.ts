import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import { SHIFT_ASSIGNMENT_STATUS, ShiftAssignmentStatus } from '@constants/enums';

export interface IShiftAssignment extends Document {
  shift: Types.ObjectId;
  employee: Types.ObjectId;
  status: ShiftAssignmentStatus;
  assignedBy?: Types.ObjectId;
  isAiGenerated: boolean;
  confirmedAt?: Date;
  notes?: string;
}

const shiftAssignmentSchema = new Schema<IShiftAssignment>(
  {
    shift: { type: Schema.Types.ObjectId, ref: 'Shift', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    status: { type: String, enum: SHIFT_ASSIGNMENT_STATUS, default: 'assigned' },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isAiGenerated: { type: Boolean, default: false },
    confirmedAt: { type: Date },
    notes: { type: String },
  },
  schemaOptions
);

shiftAssignmentSchema.index({ shift: 1, employee: 1 }, { unique: true });

export const ShiftAssignment = model<IShiftAssignment>('ShiftAssignment', shiftAssignmentSchema);
