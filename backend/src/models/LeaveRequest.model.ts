import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import { LEAVE_TYPE, LeaveType, LEAVE_STATUS, LeaveStatus } from '@constants/enums';

interface IApprovalStep {
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  comment?: string;
}

export interface ILeaveRequest extends Document {
  employee: Types.ObjectId;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason?: string;
  status: LeaveStatus;
  attachments: Types.ObjectId[];
  departmentApproval?: IApprovalStep;
  hrApproval?: IApprovalStep;
  rejectionReason?: string;
}

const approvalStepSchema = new Schema<IApprovalStep>(
  {
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    comment: { type: String },
  },
  { _id: false }
);

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveType: { type: String, enum: LEAVE_TYPE, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, min: 0.5 },
    reason: { type: String },
    status: { type: String, enum: LEAVE_STATUS, default: 'pending', index: true },
    attachments: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
    departmentApproval: approvalStepSchema,
    hrApproval: approvalStepSchema,
    rejectionReason: { type: String },
  },
  schemaOptions
);

leaveRequestSchema.index({ employee: 1, startDate: 1, endDate: 1 });

export const LeaveRequest = model<ILeaveRequest>('LeaveRequest', leaveRequestSchema);
