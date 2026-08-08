import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import { ATTENDANCE_STATUS, AttendanceStatus } from '@constants/enums';

interface IClockEvent {
  time: Date;
  method: 'manual' | 'gps' | 'qr';
  location?: { lat: number; lng: number };
}

interface IBreakPeriod {
  start: Date;
  end?: Date;
}

export interface IAttendance extends Document {
  employee: Types.ObjectId;
  shift?: Types.ObjectId;
  date: Date;
  clockIn?: IClockEvent;
  clockOut?: IClockEvent;
  breaks: IBreakPeriod[];
  status: AttendanceStatus;
  totalHoursWorked?: number;
  overtimeHours?: number;
  notes?: string;
}

const clockEventSchema = new Schema<IClockEvent>(
  {
    time: { type: Date, required: true },
    method: { type: String, enum: ['manual', 'gps', 'qr'], default: 'manual' },
    location: {
      lat: Number,
      lng: Number,
    },
  },
  { _id: false }
);

const breakPeriodSchema = new Schema<IBreakPeriod>(
  {
    start: { type: Date, required: true },
    end: { type: Date },
  },
  { _id: false }
);

const attendanceSchema = new Schema<IAttendance>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    shift: { type: Schema.Types.ObjectId, ref: 'Shift' },
    date: { type: Date, required: true, index: true },
    clockIn: clockEventSchema,
    clockOut: clockEventSchema,
    breaks: { type: [breakPeriodSchema], default: [] },
    status: { type: String, enum: ATTENDANCE_STATUS, default: 'present', index: true },
    totalHoursWorked: { type: Number, min: 0 },
    overtimeHours: { type: Number, min: 0, default: 0 },
    notes: { type: String },
  },
  schemaOptions
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

export const Attendance = model<IAttendance>('Attendance', attendanceSchema);
