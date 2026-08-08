import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import { SHIFT_SWAP_STATUS, ShiftSwapStatus } from '@constants/enums';

export interface IShiftSwapRequest extends Document {
  requestingEmployee: Types.ObjectId;
  requestingShift: Types.ObjectId;
  targetEmployee?: Types.ObjectId;
  targetShift?: Types.ObjectId;
  status: ShiftSwapStatus;
  reason?: string;
  acceptedAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
}

const shiftSwapRequestSchema = new Schema<IShiftSwapRequest>(
  {
    requestingEmployee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    requestingShift: { type: Schema.Types.ObjectId, ref: 'Shift', required: true },
    targetEmployee: { type: Schema.Types.ObjectId, ref: 'Employee' },
    targetShift: { type: Schema.Types.ObjectId, ref: 'Shift' },
    status: { type: String, enum: SHIFT_SWAP_STATUS, default: 'pending', index: true },
    reason: { type: String },
    acceptedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
  },
  schemaOptions
);

export const ShiftSwapRequest = model<IShiftSwapRequest>('ShiftSwapRequest', shiftSwapRequestSchema);
