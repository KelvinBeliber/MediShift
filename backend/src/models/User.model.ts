import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { schemaOptions } from './shared/schemaOptions';

export interface IRefreshTokenRecord {
  /** The rotating token id — a new one is minted on every refresh. */
  token: string;
  /**
   * The login session this token belongs to. Rotation preserves it, so a single
   * sign-out (or a detected replay) can revoke the whole family rather than just
   * the one token the client happened to present.
   */
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}

export interface IUser extends Document {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: Types.ObjectId;
  employee?: Types.ObjectId;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  refreshTokens: IRefreshTokenRecord[];
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const refreshTokenSchema = new Schema<IRefreshTokenRecord>(
  {
    token: { type: String, required: true },
    sessionId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    ip: { type: String },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false, minlength: 8 },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee' },
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  schemaOptions
);

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

userSchema.pre('save', async function preSave() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser>('User', userSchema);
