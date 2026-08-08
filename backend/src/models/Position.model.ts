import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';

export interface IPosition extends Document {
  title: string;
  description?: string;
  salaryRange?: { min: number; max: number };
  requiredCertifications: Types.ObjectId[];
  requiredSkills: string[];
  defaultWorkingHoursPerWeek: number;
  isActive: boolean;
}

const positionSchema = new Schema<IPosition>(
  {
    title: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    salaryRange: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
    },
    requiredCertifications: [{ type: Schema.Types.ObjectId, ref: 'Certification' }],
    requiredSkills: [{ type: String, trim: true }],
    defaultWorkingHoursPerWeek: { type: Number, default: 40, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  schemaOptions
);

export const Position = model<IPosition>('Position', positionSchema);
