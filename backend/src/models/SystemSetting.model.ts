import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';

export interface ISystemSetting extends Document {
  key: string;
  value: unknown;
  description?: string;
  updatedBy?: Types.ObjectId;
}

const systemSettingSchema = new Schema<ISystemSetting>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed },
    description: { type: String },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions
);

export const SystemSetting = model<ISystemSetting>('SystemSetting', systemSettingSchema);
