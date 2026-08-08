import crypto from 'crypto';
import { User, IUser } from '@models/User.model';
import { Role } from '@models/Role.model';
import { Employee } from '@models/Employee.model';
import { ApiError } from '@utils/ApiError';
import { generateRawToken, hashToken } from '@utils/tokens';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@utils/jwt';
import { sendEmail, buildVerificationEmail, buildPasswordResetEmail } from '@services/notifications/email.service';
import { logger } from '@utils/logger';
import { ROLES } from '@constants/roles';
import { env } from '@config/env';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function parseExpiresInToMs(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return value * unitMs;
}

interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeId?: string;
}

async function issueTokenPair(user: IUser, meta: RequestMeta) {
  const role = await Role.findById(user.role);
  if (!role) {
    throw ApiError.internal('User role could not be resolved');
  }

  const userId = String(user._id);
  const accessToken = signAccessToken({ sub: userId, role: role.name });
  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: userId, tokenId });

  const expiresAt = new Date(Date.now() + parseExpiresInToMs(env.jwt.refreshExpiresIn));

  await User.updateOne(
    { _id: user._id },
    {
      $pull: { refreshTokens: { expiresAt: { $lt: new Date() } } },
    }
  );
  await User.updateOne(
    { _id: user._id },
    {
      $push: {
        refreshTokens: {
          token: tokenId,
          createdAt: new Date(),
          expiresAt,
          userAgent: meta.userAgent,
          ip: meta.ip,
        },
      },
    }
  );

  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput) {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  let employee = null;
  if (input.employeeId) {
    employee = await Employee.findOne({ employeeId: input.employeeId.toUpperCase() });
    if (!employee) {
      throw ApiError.badRequest('No employee record found for the provided employee ID');
    }
    if (employee.user) {
      throw ApiError.conflict('This employee record is already linked to an account');
    }
    if (employee.email.toLowerCase() !== input.email.toLowerCase()) {
      throw ApiError.badRequest('Email does not match the employee record on file');
    }
  }

  const employeeRole = await Role.findOne({ name: ROLES.EMPLOYEE });
  if (!employeeRole) {
    throw ApiError.internal('Default role not seeded. Run the database seed script first.');
  }

  const rawVerificationToken = generateRawToken();

  const user = await User.create({
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    role: employeeRole._id,
    employee: employee?._id,
    emailVerificationToken: hashToken(rawVerificationToken),
    emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  });

  if (employee) {
    employee.user = user._id as typeof employee.user;
    await employee.save();
  }

  const emailContent = buildVerificationEmail(rawVerificationToken);
  try {
    await sendEmail({ to: user.email, ...emailContent });
  } catch (error) {
    logger.error('Failed to send verification email', error);
  }

  return { id: user.id, email: user.email };
}

export async function login(email: string, password: string, meta: RequestMeta) {
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated. Contact your administrator.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokenPair(user, meta);
  const role = await Role.findById(user.role);

  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: role?.name,
      isEmailVerified: user.isEmailVerified,
    },
  };
}

export async function refreshTokens(refreshTokenRaw: string, meta: RequestMeta) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenRaw);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub).select('+refreshTokens');
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is inactive or no longer exists');
  }

  const tokenRecord = user.refreshTokens.find((t) => t.token === payload.tokenId);
  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    // Possible token reuse/replay — revoke all sessions defensively.
    await User.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } });
    throw ApiError.unauthorized('Refresh token is invalid or has been revoked');
  }

  await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: { token: payload.tokenId } } });

  return issueTokenPair(user, meta);
}

export async function logout(userId: string, refreshTokenRaw?: string): Promise<void> {
  if (!refreshTokenRaw) {
    return;
  }
  try {
    const payload = verifyRefreshToken(refreshTokenRaw);
    await User.updateOne({ _id: userId }, { $pull: { refreshTokens: { token: payload.tokenId } } });
  } catch {
    // token already invalid/expired — nothing to revoke
  }
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ email });
  if (!user) {
    // Do not reveal whether the email exists.
    return;
  }

  const rawToken = generateRawToken();
  user.passwordResetToken = hashToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await user.save();

  const emailContent = buildPasswordResetEmail(rawToken);
  try {
    await sendEmail({ to: user.email, ...emailContent });
  } catch (error) {
    logger.error('Failed to send password reset email', error);
  }
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const hashed = hashToken(rawToken);
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  }).select('+password +passwordResetToken +passwordResetExpires');

  if (!user) {
    throw ApiError.badRequest('Password reset token is invalid or has expired');
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = [];
  await user.save();
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId).select('+password +refreshTokens');
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const isValid = await user.comparePassword(currentPassword);
  if (!isValid) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  user.password = newPassword;
  // Invalidate every other session — the same defensive posture as a full
  // password reset, since a compromised session shouldn't survive a password change.
  user.refreshTokens = [];
  await user.save();
}

export async function resendVerification(email: string): Promise<void> {
  const user = await User.findOne({ email });
  // Do not reveal whether the account exists or is already verified.
  if (!user || user.isEmailVerified) {
    return;
  }

  const rawVerificationToken = generateRawToken();
  user.emailVerificationToken = hashToken(rawVerificationToken);
  user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  await user.save();

  const emailContent = buildVerificationEmail(rawVerificationToken);
  try {
    await sendEmail({ to: user.email, ...emailContent });
  } catch (error) {
    logger.error('Failed to send verification email', error);
  }
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const hashed = hashToken(rawToken);
  const user = await User.findOne({
    emailVerificationToken: hashed,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) {
    throw ApiError.badRequest('Email verification token is invalid or has expired');
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
}

export async function getMe(userId: string) {
  const user = await User.findById(userId)
    .populate({ path: 'role', populate: { path: 'permissions' } })
    .populate('employee');
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user;
}
