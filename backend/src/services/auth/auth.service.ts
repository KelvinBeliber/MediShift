import crypto from 'crypto';
import bcrypt from 'bcryptjs';
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

/** A real bcrypt hash of a value nobody can supply — see `login()`. */
const DUMMY_PASSWORD_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO.qYyG9zZ3Ip5J8y1YB0kqhFqFqYyPzS';

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

async function issueTokenPair(user: IUser, meta: RequestMeta, existingSessionId?: string) {
  const sessionId = existingSessionId ?? crypto.randomUUID();

  const role = await Role.findById(user.role);
  if (!role) {
    throw ApiError.internal('User role could not be resolved');
  }

  const userId = String(user._id);
  const accessToken = signAccessToken({ sub: userId, role: role.name });
  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: userId, tokenId, sessionId });

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
          sessionId,
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

/** Drops every refresh token for a user — used wherever credentials change. */
async function revokeAllSessions(userId: unknown): Promise<void> {
  await User.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
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
  if (!user) {
    // Burn a comparable amount of time on a dummy hash. Returning early here
    // would make "no such account" measurably faster than "wrong password",
    // which is a free user-enumeration oracle on top of an endpoint that
    // deliberately returns an identical message for both.
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!(await user.comparePassword(password))) {
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
    // A signature-valid token that is no longer on file means it was already
    // rotated away (or revoked) and is now being replayed — assume theft and
    // revoke every session, not just this family.
    await revokeAllSessions(user._id);
    throw ApiError.unauthorized('Refresh token is invalid or has been revoked');
  }

  // Rotate within the same family so a later sign-out can still reach this
  // session, whichever generation of the token the client ends up holding.
  await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: { token: payload.tokenId } } });

  return issueTokenPair(user, meta, tokenRecord.sessionId);
}

/**
 * Revoke the session a refresh token belongs to.
 *
 * Deliberately keyed off the *refresh token* rather than the caller's access
 * token: sign-out has to work when the access token has already expired, and it
 * must revoke server-side state rather than trusting the client to forget. The
 * whole session family is dropped, so a rotation that raced the sign-out (a
 * background 401 refreshing at the same moment) cannot leave a live token
 * behind. Always resolves — a caller with nothing to revoke is a no-op, so the
 * endpoint never doubles as a probe for whether a session exists.
 */
export async function logout(refreshTokenRaw?: string, userId?: string): Promise<void> {
  if (refreshTokenRaw) {
    try {
      const payload = verifyRefreshToken(refreshTokenRaw);
      await User.updateOne(
        { _id: payload.sub },
        { $pull: { refreshTokens: { sessionId: payload.sessionId } } }
      );
      return;
    } catch {
      // Fall through: an expired or malformed cookie shouldn't stop us from
      // cleaning up on behalf of an authenticated caller.
    }
  }

  // No usable refresh token. If the caller still holds a valid access token we
  // cannot tell which session it belongs to (access tokens carry no session
  // id), so drop them all rather than leave the user signed in after they
  // explicitly asked to leave.
  if (userId) {
    await revokeAllSessions(userId);
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
  await user.save();

  // `refreshTokens` is `select: false` and was not loaded above, so assigning it
  // on the document would not reliably persist. Whoever reset this password may
  // be locking out whoever stole the account — every existing session has to go,
  // and it has to go for certain.
  await revokeAllSessions(user._id);
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
  await user.save();

  // Invalidate every session — the same defensive posture as a full password
  // reset, since a compromised session shouldn't survive a password change.
  await revokeAllSessions(user._id);
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
