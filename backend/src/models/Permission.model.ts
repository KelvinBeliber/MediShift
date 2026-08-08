import { Schema, model, Document } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';

export interface IPermission extends Document {
  key: string;
  module: string;
  description?: string;
}

const permissionSchema = new Schema<IPermission>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    module: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
  },
  schemaOptions
);

export const Permission = model<IPermission>('Permission', permissionSchema);
