import { Schema, model, Document, Types } from 'mongoose';
import { schemaOptions } from './shared/schemaOptions';

interface IReadReceipt {
  user: Types.ObjectId;
  readAt: Date;
}

export interface IMessage extends Document {
  sender: Types.ObjectId;
  conversationType: 'direct' | 'department';
  recipient?: Types.ObjectId;
  department?: Types.ObjectId;
  content: string;
  attachments: Types.ObjectId[];
  readBy: IReadReceipt[];
  deletedFor: Types.ObjectId[];
}

const readReceiptSchema = new Schema<IReadReceipt>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversationType: { type: String, enum: ['direct', 'department'], required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User' },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    content: { type: String, required: true },
    attachments: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
    readBy: { type: [readReceiptSchema], default: [] },
    deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  schemaOptions
);

messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ department: 1, createdAt: -1 });

export const Message = model<IMessage>('Message', messageSchema);
