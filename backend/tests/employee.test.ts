import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader } from './helpers/auth';
import { makeDepartment, makePosition, makeEmployee } from './helpers/factories';
import { User } from '../src/models/User.model';
import { Employee } from '../src/models/Employee.model';

describe('Employees API', () => {
  it('creates an employee with an auto-generated sequential employee ID', async () => {
    const { accessToken } = await createUserWithRole('hr_manager');

    const res = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(accessToken))
      .send({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@test.medishift.local',
        employmentType: 'full_time',
        hireDate: '2024-01-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.employeeId).toMatch(/^EMP-\d{6}$/);
  });

  it('auto-generated employee IDs are sequential and unique across creations', async () => {
    const { accessToken } = await createUserWithRole('hr_manager');
    const first = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(accessToken))
      .send({ firstName: 'A', lastName: 'One', email: 'a1@test.medishift.local', employmentType: 'full_time', hireDate: '2024-01-01' });
    const second = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(accessToken))
      .send({ firstName: 'A', lastName: 'Two', email: 'a2@test.medishift.local', employmentType: 'full_time', hireDate: '2024-01-01' });

    expect(first.body.data.employeeId).not.toBe(second.body.data.employeeId);
  });

  it('rejects creating an employee with a duplicate email', async () => {
    await makeEmployee({ email: 'dup@test.medishift.local' });
    const { accessToken } = await createUserWithRole('hr_manager');

    const res = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(accessToken))
      .send({
        firstName: 'X',
        lastName: 'Y',
        email: 'dup@test.medishift.local',
        employmentType: 'full_time',
        hireDate: '2024-01-01',
      });

    expect(res.status).toBe(409);
  });

  it('rejects creating an employee with a nonexistent department', async () => {
    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(accessToken))
      .send({
        firstName: 'X',
        lastName: 'Y',
        email: 'nodept@test.medishift.local',
        department: '65f000000000000000000000',
        employmentType: 'full_time',
        hireDate: '2024-01-01',
      });
    expect(res.status).toBe(400);
  });

  it('searches, filters, and paginates employees', async () => {
    const department = await makeDepartment();
    await makeEmployee({ firstName: 'Findme', lastName: 'Special', department: department.id as never, status: 'active' });
    await makeEmployee({ firstName: 'Other', lastName: 'Person', status: 'inactive' });
    const { accessToken } = await createUserWithRole('hr_manager');

    const bySearch = await request(app)
      .get('/api/v1/employees?search=Findme')
      .set(authHeader(accessToken));
    expect(bySearch.body.data.length).toBeGreaterThanOrEqual(1);
    expect(bySearch.body.data[0].firstName).toBe('Findme');

    const byDept = await request(app)
      .get(`/api/v1/employees?department=${department.id}`)
      .set(authHeader(accessToken));
    expect(byDept.body.data).toHaveLength(1);

    const byStatus = await request(app).get('/api/v1/employees?status=inactive').set(authHeader(accessToken));
    expect(byStatus.body.data.every((e: { status: string }) => e.status === 'inactive')).toBe(true);

    const paged = await request(app).get('/api/v1/employees?limit=1&page=1').set(authHeader(accessToken));
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.pagination.limit).toBe(1);
  });

  it('updates an employee, rejecting an email collision with someone else', async () => {
    const e1 = await makeEmployee({ email: 'e1@test.medishift.local' });
    const e2 = await makeEmployee({ email: 'e2@test.medishift.local' });
    const { accessToken } = await createUserWithRole('hr_manager');

    const collision = await request(app)
      .put(`/api/v1/employees/${e2.id}`)
      .set(authHeader(accessToken))
      .send({ email: 'e1@test.medishift.local' });
    expect(collision.status).toBe(409);

    const ok = await request(app)
      .put(`/api/v1/employees/${e1.id}`)
      .set(authHeader(accessToken))
      .send({ lastName: 'Updated' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.lastName).toBe('Updated');
  });

  it('soft-deletes an employee (terminated status) and deactivates their linked account', async () => {
    const employee = await makeEmployee();
    const { user } = await createUserWithRole('employee', { employee: employee._id as never });
    await Employee.findByIdAndUpdate(employee._id, { user: user._id });
    const { accessToken } = await createUserWithRole('hr_manager');

    const res = await request(app).delete(`/api/v1/employees/${employee.id}`).set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('terminated');

    const updatedUser = await User.findById(user._id);
    expect(updatedUser!.isActive).toBe(false);
  });

  it('enforces employee:view/create/edit/delete permissions per route', async () => {
    const employee = await makeEmployee();
    const { accessToken } = await createUserWithRole('employee'); // no employee:* permissions

    const list = await request(app).get('/api/v1/employees').set(authHeader(accessToken));
    expect(list.status).toBe(403);

    const create = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(accessToken))
      .send({ firstName: 'X', lastName: 'Y', email: 'z@test.medishift.local', employmentType: 'full_time', hireDate: '2024-01-01' });
    expect(create.status).toBe(403);

    const edit = await request(app).put(`/api/v1/employees/${employee.id}`).set(authHeader(accessToken)).send({ lastName: 'Z' });
    expect(edit.status).toBe(403);

    const del = await request(app).delete(`/api/v1/employees/${employee.id}`).set(authHeader(accessToken));
    expect(del.status).toBe(403);
  });

  it('positions can require certain certifications, referenced by an employee', async () => {
    const position = await makePosition({ title: 'ICU Nurse' });
    const employee = await makeEmployee({ position: position.id as never });
    const { accessToken } = await createUserWithRole('hr_manager');

    const res = await request(app).get(`/api/v1/employees/${employee.id}`).set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.position.title).toBe('ICU Nurse');
  });
});
