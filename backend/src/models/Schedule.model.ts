import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import { SCHEDULE_STATUS, ScheduleStatus } from '@constants/enums';

export interface ISchedule extends Document {
  department: Types.ObjectId;
  month: number;
  year: number;
  startDate: Date;
  endDate: Date;
  status: ScheduleStatus;
  generatedBy?: Types.ObjectId;
  publishedBy?: Types.ObjectId;
  publishedAt?: Date;
  notes?: string;
  constraintsSnapshot?: Record<string, unknown>;
  stats?: Record<string, unknown>;
}

const scheduleSchema = new Schema<ISchedule>(
  {
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: SCHEDULE_STATUS, default: 'draft', index: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    publishedAt: { type: Date },
    notes: { type: String },
    constraintsSnapshot: { type: Schema.Types.Mixed },
    stats: { type: Schema.Types.Mixed },
  },
  schemaOptions
);

scheduleSchema.index({ department: 1, month: 1, year: 1 }, { unique: true });

scheduleSchema.virtual('shifts', {
  ref: 'Shift',
  localField: '_id',
  foreignField: 'schedule',
});

export const Schedule = model<ISchedule>('Schedule', scheduleSchema);
