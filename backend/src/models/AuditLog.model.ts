import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';

export interface IAuditLog extends Document {
  user?: Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  schemaOptions
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
