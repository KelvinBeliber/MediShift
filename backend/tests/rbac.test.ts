import request from 'supertest';
import { Request, Response } from 'express';
import { app } from './helpers/app';
import { createUserWithRole, authHeader } from './helpers/auth';
import { User } from '../src/models/User.model';
import { Role } from '../src/models/Role.model';
import { Permission } from '../src/models/Permission.model';
import { authorize, authorizeAny } from '../src/middleware/authorize';
import { AuthenticatedUser } from '../src/types/express';

function mockReqRes(permissions: string[]) {
  const req = { user: { id: 'u1', email: 'x@test.local', roleId: 'r1', roleName: 'test', permissions } as AuthenticatedUser } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn();
  return { req, res, next };
}

describe('RBAC', () => {
  it('permissions are resolved fresh from the database on every request, not baked into the JWT', async () => {
    const { user, accessToken } = await createUserWithRole('employee');

    // Employees can't view all employees by default.
    const before = await request(app).get('/api/v1/employees').set(authHeader(accessToken));
    expect(before.status).toBe(403);

    // The 'employee' role is shared, seeded reference data (see tests/setup.ts,
    // which deliberately preserves the roles/permissions collections across
    // tests) — mutating it here must be undone, or every later test that
    // assumes a normal restricted 'employee' role breaks.
    const originalPermissions = (await Role.findById(user.role))!.permissions;
    try {
      const allPermissionIds = (await Permission.find().select('_id')).map((p) => p._id);
      await Role.updateOne({ _id: user.role }, { $set: { permissions: allPermissionIds } });

      const after = await request(app).get('/api/v1/employees').set(authHeader(accessToken));
      expect(after.status).toBe(200);
    } finally {
      await Role.updateOne({ _id: user.role }, { $set: { permissions: originalPermissions } });
    }
  });

  it('rejects requests from a deactivated user even with a structurally valid token', async () => {
    const { user, accessToken } = await createUserWithRole('hospital_admin');
    await User.findByIdAndUpdate(user._id, { isActive: false });

    const res = await request(app).get('/api/v1/auth/me').set(authHeader(accessToken));
    expect(res.status).toBe(401);
  });

  it('a permission-gated route denies a role lacking that permission and allows one that has it', async () => {
    // department:manage is required to create a department; hospital_admin has it.
    const { accessToken: adminToken } = await createUserWithRole('hospital_admin');
    const created = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(adminToken))
      .send({ name: 'RBAC Test Dept', code: 'RBAC1' });
    expect(created.status).toBe(201);

    // shift_coordinator has schedule:* but not department:manage.
    const { accessToken: coordinatorToken } = await createUserWithRole('shift_coordinator');
    const denied = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(coordinatorToken))
      .send({ name: 'Should Fail', code: 'RBAC2' });
    expect(denied.status).toBe(403);
  });

  describe('authorize() / authorizeAny() middleware semantics', () => {
    it('authorize() requires every listed permission, not just one', () => {
      const middleware = authorize('employee:view' as never, 'employee:edit' as never);

      const onlyOne = mockReqRes(['employee:view']);
      middleware(onlyOne.req, onlyOne.res, onlyOne.next);
      expect(onlyOne.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));

      const both = mockReqRes(['employee:view', 'employee:edit']);
      middleware(both.req, both.res, both.next);
      expect(both.next).toHaveBeenCalledWith(); // called with no error argument
    });

    it('authorizeAny() passes with just one of the listed permissions', () => {
      const middleware = authorizeAny('employee:view' as never, 'employee:edit' as never);

      const neither = mockReqRes([]);
      middleware(neither.req, neither.res, neither.next);
      expect(neither.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));

      const justOne = mockReqRes(['employee:edit']);
      middleware(justOne.req, justOne.res, justOne.next);
      expect(justOne.next).toHaveBeenCalledWith();
    });

    it('both middlewares reject when req.user is missing entirely', () => {
      const req = {} as Request;
      const res = {} as Response;
      const next = jest.fn();

      authorize('employee:view' as never)(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });
  });

  it('authorizeAny() allows access if the user holds at least one of the listed permissions', async () => {
    // Attendance clock-in requires attendance:record_own OR attendance:manage.
    const { accessToken: employeeToken } = await createUserWithRole('employee'); // has record_own only
    const { accessToken: hrToken } = await createUserWithRole('hr_manager'); // has manage only, not record_own

    const employeeAttempt = await request(app)
      .post('/api/v1/attendance/clock-in')
      .set(authHeader(employeeToken))
      .send({ method: 'manual' });
    // Fails for a different reason (no linked employee profile), but must get
    // PAST the authorization check to reach that point — not a 403.
    expect(employeeAttempt.status).not.toBe(403);

    const hrAttempt = await request(app)
      .post('/api/v1/attendance/clock-in')
      .set(authHeader(hrToken))
      .send({ employeeId: '65f000000000000000000000', method: 'manual' });
    expect(hrAttempt.status).not.toBe(403);
  });

  it('GET /roles exposes the seeded roles with their permissions populated', async () => {
    const { accessToken } = await createUserWithRole('employee');
    const res = await request(app).get('/api/v1/roles').set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const roleNames = res.body.data.map((r: { name: string }) => r.name);
    expect(roleNames).toEqual(
      expect.arrayContaining(['super_admin', 'hospital_admin', 'hr_manager', 'department_head', 'shift_coordinator', 'employee'])
    );

    const superAdmin = res.body.data.find((r: { name: string }) => r.name === 'super_admin');
    const employeeRole = res.body.data.find((r: { name: string }) => r.name === 'employee');
    expect(superAdmin.permissions.length).toBeGreaterThan(employeeRole.permissions.length);
  });

  it('GET /roles/permissions lists every permission in the system', async () => {
    const { accessToken } = await createUserWithRole('employee');
    const res = await request(app).get('/api/v1/roles/permissions').set(authHeader(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(30);
    expect(res.body.data.some((p: { key: string }) => p.key === 'employee:view')).toBe(true);
  });
});
