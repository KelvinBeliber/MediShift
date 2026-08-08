import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import { DOCUMENT_TYPE, DocumentType } from '@constants/enums';

export interface IDocument extends MongooseDocument {
  owner: Types.ObjectId;
  type: DocumentType;
  fileName: string;
  url: string;
  publicId?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy: Types.ObjectId;
  expiryDate?: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    type: { type: String, enum: DOCUMENT_TYPE, required: true },
    fileName: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String },
    mimeType: { type: String },
    sizeBytes: { type: Number },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiryDate: { type: Date },
  },
  schemaOptions
);

export const Document = model<IDocument>('Document', documentSchema);
