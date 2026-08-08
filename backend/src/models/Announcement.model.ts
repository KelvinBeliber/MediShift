import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import {
  ANNOUNCEMENT_PRIORITY,
  AnnouncementPriority,
  ANNOUNCEMENT_SCOPE,
  AnnouncementScope,
} from '@constants/enums';

export interface IAnnouncement extends Document {
  title: string;
  body: string;
  scope: AnnouncementScope;
  department?: Types.ObjectId;
  priority: AnnouncementPriority;
  author: Types.ObjectId;
  publishedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    scope: { type: String, enum: ANNOUNCEMENT_SCOPE, required: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    priority: { type: String, enum: ANNOUNCEMENT_PRIORITY, default: 'normal', index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    publishedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  schemaOptions
);

export const Announcement = model<IAnnouncement>('Announcement', announcementSchema);
