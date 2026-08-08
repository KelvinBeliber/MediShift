import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader } from './helpers/auth';
import { makeDepartment, makeEmployee } from './helpers/factories';

describe('Departments API', () => {
  it('creates a department and rejects a duplicate name or code', async () => {
    const { accessToken } = await createUserWithRole('hospital_admin');

    const created = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(accessToken))
      .send({ name: 'Emergency', code: 'ER' });
    expect(created.status).toBe(201);

    const dupName = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(accessToken))
      .send({ name: 'Emergency', code: 'ER2' });
    expect(dupName.status).toBe(409);

    const dupCode = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(accessToken))
      .send({ name: 'Emergency Room 2', code: 'ER' });
    expect(dupCode.status).toBe(409);
  });

  it('assigns a manager, linking the employee to the department if unassigned', async () => {
    const department = await makeDepartment();
    const employee = await makeEmployee(); // no department yet
    const { accessToken } = await createUserWithRole('hospital_admin');

    const res = await request(app)
      .post(`/api/v1/departments/${department.id}/manager`)
      .set(authHeader(accessToken))
      .send({ employeeId: employee.id });

    expect(res.status).toBe(200);
    expect(res.body.data.manager).toBe(employee.id);
  });

  it('rejects assigning a manager who belongs to a different department', async () => {
    const departmentA = await makeDepartment();
    const departmentB = await makeDepartment();
    const employee = await makeEmployee({ department: departmentB.id as never });
    const { accessToken } = await createUserWithRole('hospital_admin');

    const res = await request(app)
      .post(`/api/v1/departments/${departmentA.id}/manager`)
      .set(authHeader(accessToken))
      .send({ employeeId: employee.id });

    expect(res.status).toBe(400);
  });

  it('bulk-assigns employees to a department', async () => {
    const department = await makeDepartment();
    const e1 = await makeEmployee();
    const e2 = await makeEmployee();
    const { accessToken } = await createUserWithRole('hospital_admin');

    const res = await request(app)
      .post(`/api/v1/departments/${department.id}/employees`)
      .set(authHeader(accessToken))
      .send({ employeeIds: [e1.id, e2.id] });

    expect(res.status).toBe(200);
    expect(res.body.data.modifiedCount).toBe(2);
  });

  it('returns department stats: headcount and breakdown by employment type', async () => {
    const department = await makeDepartment();
    await makeEmployee({ department: department.id as never, employmentType: 'full_time', status: 'active' });
    await makeEmployee({ department: department.id as never, employmentType: 'part_time', status: 'active' });
    await makeEmployee({ department: department.id as never, status: 'terminated' });
    const { accessToken } = await createUserWithRole('hospital_admin');

    const res = await request(app).get(`/api/v1/departments/${department.id}/stats`).set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.totalEmployees).toBe(3);
    expect(res.body.data.activeEmployees).toBe(2);
    expect(res.body.data.byEmploymentType.length).toBeGreaterThanOrEqual(2);
  });

  it('blocks deactivating a department that still has active employees', async () => {
    const department = await makeDepartment();
    await makeEmployee({ department: department.id as never, status: 'active' });
    const { accessToken } = await createUserWithRole('hospital_admin');

    const res = await request(app).delete(`/api/v1/departments/${department.id}`).set(authHeader(accessToken));
    expect(res.status).toBe(409);
  });

  it('allows deactivating a department with no active employees', async () => {
    const department = await makeDepartment();
    await makeEmployee({ department: department.id as never, status: 'terminated' });
    const { accessToken } = await createUserWithRole('hospital_admin');

    const res = await request(app).delete(`/api/v1/departments/${department.id}`).set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('denies department management without department:manage permission', async () => {
    const { accessToken } = await createUserWithRole('employee');
    const res = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(accessToken))
      .send({ name: 'Should Fail', code: 'SF' });
    expect(res.status).toBe(403);
  });
});
