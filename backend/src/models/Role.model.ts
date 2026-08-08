import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';

export interface IRole extends Document {
  name: string;
  description?: string;
  permissions: Types.ObjectId[];
  isSystemRole: boolean;
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission' }],
    isSystemRole: { type: Boolean, default: false },
  },
  schemaOptions
);

export const Role = model<IRole>('Role', roleSchema);
