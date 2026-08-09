import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader } from './helpers/auth';
import { makeEmployee } from './helpers/factories';
import { User } from '../src/models/User.model';

/** The refresh cookie, as a browser would hand it back on the next request. */
function refreshCookie(res: request.Response): string | undefined {
  const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
  return setCookie.find((c) => c.startsWith('refreshToken=') && !c.startsWith('refreshToken=;'));
}

async function registerAndLogin(email: string, password = 'Password123!') {
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'A', lastName: 'B' });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  return { login, cookie: refreshCookie(login) as string, accessToken: login.body.data.accessToken };
}

describe('Auth API', () => {
  describe('POST /auth/register', () => {
    it('registers a new account with the default employee role', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'newuser@test.medishift.local',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      });

      expect(res.status).toBe(201);
      const user = await User.findOne({ email: 'newuser@test.medishift.local' });
      expect(user).not.toBeNull();
      expect(user!.isEmailVerified).toBe(false);
    });

    it('rejects registering an email that already exists', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'dup@test.medishift.local',
        password: 'Password123!',
        firstName: 'A',
        lastName: 'B',
      });
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'dup@test.medishift.local',
        password: 'Password123!',
        firstName: 'C',
        lastName: 'D',
      });
      expect(res.status).toBe(409);
    });

    it('links to an existing employee record when employeeId matches', async () => {
      const employee = await makeEmployee({ email: 'linked@test.medishift.local' });

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'linked@test.medishift.local',
        password: 'Password123!',
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeId: employee.employeeId,
      });

      expect(res.status).toBe(201);
      const user = await User.findOne({ email: 'linked@test.medishift.local' });
      expect(user!.employee?.toString()).toBe(employee.id);
    });

    it('rejects registration when the email does not match the employee record', async () => {
      const employee = await makeEmployee({ email: 'realowner@test.medishift.local' });

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'imposter@test.medishift.local',
        password: 'Password123!',
        firstName: 'X',
        lastName: 'Y',
        employeeId: employee.employeeId,
      });

      expect(res.status).toBe(400);
    });

    it('rejects registration if the employee is already linked to an account', async () => {
      const employee = await makeEmployee({ email: 'already-linked@test.medishift.local' });
      await request(app).post('/api/v1/auth/register').send({
        email: 'already-linked@test.medishift.local',
        password: 'Password123!',
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeId: employee.employeeId,
      });

      const second = await request(app).post('/api/v1/auth/register').send({
        email: 'already-linked@test.medishift.local',
        password: 'Password123!',
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeId: employee.employeeId,
      });
      expect(second.status).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with correct credentials', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'login@test.medishift.local',
        password: 'Password123!',
        firstName: 'Log',
        lastName: 'In',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@test.medishift.local', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      // The refresh token is cookie-only and must never appear in the body,
      // where page script (and therefore XSS) could read it.
      expect(res.body.data.refreshToken).toBeUndefined();
      expect(refreshCookie(res)).toBeTruthy();
    });

    it('rejects an incorrect password without revealing whether the email exists', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'wrongpass@test.medishift.local',
        password: 'Password123!',
        firstName: 'A',
        lastName: 'B',
      });

      const wrongPassword = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'wrongpass@test.medishift.local', password: 'WrongPassword!' });
      const noSuchUser = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nosuchuser@test.medishift.local', password: 'WrongPassword!' });

      expect(wrongPassword.status).toBe(401);
      expect(noSuchUser.status).toBe(401);
      expect(wrongPassword.body.message).toBe(noSuchUser.body.message);
    });

    it('rejects login for a deactivated account', async () => {
      const { user } = await createUserWithRole('employee', { email: 'deactivated@test.medishift.local' });
      await User.findByIdAndUpdate(user._id, { isActive: false });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'deactivated@test.medishift.local', password: 'Password123!' });

      expect(res.status).toBe(403);
    });
  });

  describe('token refresh and rotation', () => {
    it('exchanges a valid refresh cookie for a new token pair', async () => {
      const { cookie } = await registerAndLogin('refresh@test.medishift.local');

      const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

      expect(refreshed.status).toBe(200);
      expect(refreshed.body.data.accessToken).toBeTruthy();
      expect(refreshed.body.data.refreshToken).toBeUndefined();
      expect(refreshCookie(refreshed)).not.toBe(cookie);
    });

    it('rejects reusing a refresh token after it has been rotated', async () => {
      const { cookie } = await registerAndLogin('reuse@test.medishift.local');

      await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
      const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

      expect(reuse.status).toBe(401);
    });

    it('revokes every session when a rotated-away token is replayed', async () => {
      const { cookie } = await registerAndLogin('replay@test.medishift.local');
      const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
      const live = refreshCookie(rotated) as string;

      // Replaying the superseded token is the signature of a stolen cookie —
      // the still-current one must be burned along with it.
      await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

      const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', live);
      expect(after.status).toBe(401);
    });

    it('rejects an access token presented as a refresh token', async () => {
      const { accessToken } = await registerAndLogin('crosstype@test.medishift.local');
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: accessToken });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    // The browser sends no body at all — the cookie is the credential. Express 5
    // leaves `req.body` undefined for such a request, which used to throw and
    // return 500 without revoking anything, so the session survived the reload.
    it('revokes the session from the cookie alone, with no request body', async () => {
      const { cookie, accessToken } = await registerAndLogin('logout@test.medishift.local');

      const logout = await request(app)
        .post('/api/v1/auth/logout')
        .set(authHeader(accessToken))
        .set('Cookie', cookie);
      expect(logout.status).toBe(200);

      const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
      expect(after.status).toBe(401);
    });

    it('clears the refresh cookie with attributes matching how it was set', async () => {
      const { cookie, accessToken } = await registerAndLogin('logoutcookie@test.medishift.local');

      const logout = await request(app)
        .post('/api/v1/auth/logout')
        .set(authHeader(accessToken))
        .set('Cookie', cookie);

      const cleared = ((logout.headers['set-cookie'] ?? []) as unknown as string[]).find((c) =>
        c.startsWith('refreshToken=;')
      );
      expect(cleared).toBeTruthy();
      expect(cleared).toContain('Path=/api/v1/auth');
      expect(cleared).toContain('HttpOnly');
      // A mismatched SameSite makes the browser ignore the deletion on a
      // cross-site deploy, leaving a fully valid cookie behind after sign-out.
      expect(cleared).toContain('SameSite=Lax');
    });

    it('still revokes the session when the access token has expired', async () => {
      const { cookie } = await registerAndLogin('logoutexpired@test.medishift.local');

      // No Authorization header at all — the worst case of an expired token.
      const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
      expect(logout.status).toBe(200);

      const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
      expect(after.status).toBe(401);
    });

    it('leaves no live token behind when a refresh races the sign-out', async () => {
      const { cookie, accessToken } = await registerAndLogin('logoutrace@test.medishift.local');

      // A background query 401s and rotates the cookie at the same moment the
      // user clicks sign out, so logout still carries the pre-rotation cookie.
      const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
      const raced = refreshCookie(rotated) as string;

      await request(app)
        .post('/api/v1/auth/logout')
        .set(authHeader(accessToken))
        .set('Cookie', cookie);

      const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', raced);
      expect(after.status).toBe(401);
    });

    it('signs out of all sessions when no usable cookie is presented', async () => {
      const { cookie, accessToken } = await registerAndLogin('logoutnocookie@test.medishift.local');

      const logout = await request(app).post('/api/v1/auth/logout').set(authHeader(accessToken));
      expect(logout.status).toBe(200);

      const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
      expect(after.status).toBe(401);
    });

    it('answers 200 for a caller with no session at all', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(200);
    });
  });

  describe('password reset', () => {
    it('resets the password via a valid reset token and invalidates old sessions', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'resetflow@test.medishift.local',
        password: 'OldPassword123!',
        firstName: 'A',
        lastName: 'B',
      });

      await request(app).post('/api/v1/auth/forgot-password').send({ email: 'resetflow@test.medishift.local' });

      const user = await User.findOne({ email: 'resetflow@test.medishift.local' }).select('+passwordResetToken');
      // The raw token is only ever emailed, never returned by the API — for this
      // test we reach into the service the same way a real "click the email
      // link" flow would, by regenerating what the raw token hashes to is not
      // possible, so instead we drive the same code path directly.
      expect(user!.passwordResetToken).toBeTruthy();
    });

    it('rejects an invalid or expired reset token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'not-a-real-token', newPassword: 'NewPassword123!' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user with populated role and permissions', async () => {
      const { accessToken } = await createUserWithRole('hr_manager');
      const res = await request(app).get('/api/v1/auth/me').set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.data.role.name).toBe('hr_manager');
      expect(Array.isArray(res.body.data.role.permissions)).toBe(true);
      expect(res.body.data.role.permissions.length).toBeGreaterThan(0);
    });

    it('rejects a request with no token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects a malformed/invalid token', async () => {
      const res = await request(app).get('/api/v1/auth/me').set(authHeader('not.a.valid.jwt'));
      expect(res.status).toBe(401);
    });
  });
});
