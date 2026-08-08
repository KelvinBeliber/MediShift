import { Schema, model, Document } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';

export interface ICertification extends Document {
  name: string;
  code: string;
  description?: string;
  issuingBody?: string;
  validityPeriodMonths?: number;
  isActive: boolean;
}

const certificationSchema = new Schema<ICertification>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    issuingBody: { type: String, trim: true },
    validityPeriodMonths: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  schemaOptions
);

export const Certification = model<ICertification>('Certification', certificationSchema);
