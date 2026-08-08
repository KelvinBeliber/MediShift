import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';
import { NOTIFICATION_TYPE, NotificationType, NOTIFICATION_CHANNEL, NotificationChannel } from '@constants/enums';

export interface INotification extends Document {
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  channels: NotificationChannel[];
  isRead: boolean;
  readAt?: Date;
  relatedEntityType?: string;
  relatedEntityId?: Types.ObjectId;
  actionUrl?: string;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPE, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    channels: { type: [String], enum: NOTIFICATION_CHANNEL, default: ['in_app'] },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    relatedEntityType: { type: String },
    relatedEntityId: { type: Schema.Types.ObjectId },
    actionUrl: { type: String },
  },
  schemaOptions
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);
