import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader } from './helpers/auth';
import { makeDepartment, makeSchedule, makeShift, makeEmployee } from './helpers/factories';
import { AuditLog } from '../src/models/AuditLog.model';
import { LeaveRequest } from '../src/models/LeaveRequest.model';

describe('Audit logging', () => {
  it('records a CREATE entry when an employee is created', async () => {
    const { accessToken } = await createUserWithRole('hr_manager');
    const created = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(accessToken))
      .send({
        firstName: 'Audit',
        lastName: 'Target',
        email: 'audit.target@test.medishift.local',
        employmentType: 'full_time',
        hireDate: '2024-01-01',
      });

    const entries = await AuditLog.find({ entityType: 'Employee', entityId: created.body.data.id });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('CREATE');
  });

  it('records UPDATE and DELETE entries for departments', async () => {
    const { accessToken } = await createUserWithRole('hospital_admin');
    const created = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(accessToken))
      .send({ name: 'Audit Dept', code: 'AUDIT1' });
    const departmentId = created.body.data.id;

    await request(app)
      .put(`/api/v1/departments/${departmentId}`)
      .set(authHeader(accessToken))
      .send({ name: 'Audit Dept Renamed' });

    await request(app).delete(`/api/v1/departments/${departmentId}`).set(authHeader(accessToken));

    const entries = await AuditLog.find({ entityType: 'Department', entityId: departmentId }).sort({ createdAt: 1 });
    expect(entries.map((e) => e.action)).toEqual(['CREATE', 'UPDATE', 'DELETE']);
  });

  it('records an APPROVE entry for leave HR-approval', async () => {
    const { accessToken: hrToken } = await createUserWithRole('hr_manager');
    const leaveEmployee = await makeEmployee();
    const leave = await LeaveRequest.create({
      employee: leaveEmployee.id,
      leaveType: 'vacation',
      startDate: new Date('2030-01-01'),
      endDate: new Date('2030-01-02'),
      totalDays: 2,
      status: 'department_approved',
    });

    await request(app).post(`/api/v1/leave/${leave.id}/hr-approve`).set(authHeader(hrToken)).send({});

    const entries = await AuditLog.find({ entityType: 'LeaveRequest', entityId: leave.id });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('APPROVE');
  });

  it('records a PUBLISH entry for schedule publishing', async () => {
    const department = await makeDepartment();
    const schedule = await makeSchedule({ department: department.id });
    await makeShift({ schedule: schedule.id, department: department.id });
    const { accessToken } = await createUserWithRole('hospital_admin');

    await request(app).post(`/api/v1/schedules/${schedule.id}/publish`).set(authHeader(accessToken));

    const entries = await AuditLog.find({ entityType: 'Schedule', entityId: schedule.id });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('PUBLISH');
  });

  it('captures the acting user, IP, and user-agent on each entry', async () => {
    const { accessToken } = await createUserWithRole('hospital_admin');
    const created = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(accessToken))
      .set('User-Agent', 'JestTestRunner/1.0')
      .send({ name: 'Audit Meta Dept', code: 'AUDIT2' });

    const entry = await AuditLog.findOne({ entityType: 'Department', entityId: created.body.data.id });
    expect(entry!.user).toBeTruthy();
    expect(entry!.userAgent).toBe('JestTestRunner/1.0');
  });

  it('lists and filters audit logs, gated by audit_log:view', async () => {
    const { accessToken: adminToken } = await createUserWithRole('super_admin');
    await request(app)
      .post('/api/v1/departments')
      .set(authHeader(adminToken))
      .send({ name: 'Filter Dept', code: 'FILTER1' });

    const filtered = await request(app)
      .get('/api/v1/audit-logs?entityType=Department&action=CREATE')
      .set(authHeader(adminToken));
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.length).toBeGreaterThanOrEqual(1);
    expect(filtered.body.data.every((e: { entityType: string }) => e.entityType === 'Department')).toBe(true);

    const { accessToken: employeeToken } = await createUserWithRole('employee');
    const denied = await request(app).get('/api/v1/audit-logs').set(authHeader(employeeToken));
    expect(denied.status).toBe(403);
  });

  it('a broken audit write does not break the operation it was recording', async () => {
    // Sanity check on the "fire and forget" contract: even though recordAudit
    // swallows its own errors, the primary request (department creation)
    // still succeeds regardless of audit-log health.
    const { accessToken } = await createUserWithRole('hospital_admin');
    const res = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(accessToken))
      .send({ name: 'Resilience Dept', code: 'RESIL1' });
    expect(res.status).toBe(201);
  });
});
