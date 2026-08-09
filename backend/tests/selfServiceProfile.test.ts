import request from 'supertest';
import { app } from './helpers/app';
import { makeLinkedEmployeeUser, createUserWithRole, authHeader } from './helpers/auth';

describe('Self-service profile & password', () => {
  it('GET /employees/me returns the caller’s own linked employee record', async () => {
    const { employee, accessToken } = await makeLinkedEmployeeUser();
    const res = await request(app).get('/api/v1/employees/me').set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(employee.id);
  });

  it('PUT /employees/me updates only the allowed self-service fields', async () => {
    const { accessToken } = await makeLinkedEmployeeUser();
    const res = await request(app)
      .put('/api/v1/employees/me')
      .set(authHeader(accessToken))
      .send({ phone: '555-0100', address: { city: 'Springfield' }, emergencyContact: { name: 'Alex' } });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('555-0100');
    expect(res.body.data.address.city).toBe('Springfield');
    expect(res.body.data.emergencyContact.name).toBe('Alex');
  });

  it('PUT /employees/me rejects fields outside the safe subset (e.g. salary)', async () => {
    const { accessToken } = await makeLinkedEmployeeUser();
    const res = await request(app).put('/api/v1/employees/me').set(authHeader(accessToken)).send({ salary: 999999 });
    expect(res.status).toBe(422);
  });

  it('requires an employee link to use self-service profile routes', async () => {
    const { accessToken } = await createUserWithRole('super_admin'); // no linked employee
    const res = await request(app).get('/api/v1/employees/me').set(authHeader(accessToken));
    expect(res.status).toBe(400);
  });

  it('changes the password given the correct current password, and the new password works for login', async () => {
    const { user, accessToken } = await makeLinkedEmployeeUser();

    const change = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(accessToken))
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword456!' });
    expect(change.status).toBe(200);

    const loginWithNew = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'NewPassword456!' });
    expect(loginWithNew.status).toBe(200);

    const loginWithOld = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Password123!' });
    expect(loginWithOld.status).toBe(401);
  });

  it('rejects a password change with the wrong current password', async () => {
    const { accessToken } = await makeLinkedEmployeeUser();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(accessToken))
      .send({ currentPassword: 'WrongPassword!', newPassword: 'NewPassword456!' });
    expect(res.status).toBe(401);
  });

  it('revokes a refresh token that was issued before the password change', async () => {
    const { user, accessToken } = await makeLinkedEmployeeUser();

    // Log in for real to obtain a genuine, valid refresh cookie.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Password123!' });
    const cookie = ((login.headers['set-cookie'] ?? []) as unknown as string[]).find((c) =>
      c.startsWith('refreshToken=')
    );
    expect(cookie).toBeTruthy();

    await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(accessToken))
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword456!' });

    const refreshAttempt = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie as string);
    expect(refreshAttempt.status).toBe(401);
  });
});
