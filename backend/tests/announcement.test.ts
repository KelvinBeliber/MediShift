import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader, makeLinkedEmployeeUser } from './helpers/auth';
import { makeDepartment } from './helpers/factories';

describe('Announcements API', () => {
  it('requires a department when scope is "department"', async () => {
    const { accessToken } = await createUserWithRole('hospital_admin');
    const res = await request(app)
      .post('/api/v1/announcements')
      .set(authHeader(accessToken))
      .send({ title: 'x', body: 'y', scope: 'department' });
    expect(res.status).toBe(422);
  });

  it('a hospital-wide announcement is visible to everyone', async () => {
    const { accessToken: adminToken } = await createUserWithRole('hospital_admin');
    await request(app)
      .post('/api/v1/announcements')
      .set(authHeader(adminToken))
      .send({ title: 'Hospital-wide', body: 'Everyone sees this', scope: 'hospital', priority: 'important' });

    const { accessToken: employeeToken } = await makeLinkedEmployeeUser();
    const res = await request(app).get('/api/v1/announcements').set(authHeader(employeeToken));
    expect(res.status).toBe(200);
    expect(res.body.data.some((a: { title: string }) => a.title === 'Hospital-wide')).toBe(true);
  });

  it('a department-scoped announcement is only visible to that department', async () => {
    const departmentA = await makeDepartment();
    const departmentB = await makeDepartment();
    const { accessToken: adminToken } = await createUserWithRole('hospital_admin');

    await request(app)
      .post('/api/v1/announcements')
      .set(authHeader(adminToken))
      .send({ title: 'Dept A only', body: 'x', scope: 'department', department: departmentA.id });

    const { accessToken: employeeAToken } = await makeLinkedEmployeeUser({ department: departmentA.id } as never);
    const { accessToken: employeeBToken } = await makeLinkedEmployeeUser({ department: departmentB.id } as never);

    const aView = await request(app).get('/api/v1/announcements').set(authHeader(employeeAToken));
    expect(aView.body.data.some((a: { title: string }) => a.title === 'Dept A only')).toBe(true);

    const bView = await request(app).get('/api/v1/announcements').set(authHeader(employeeBToken));
    expect(bView.body.data.some((a: { title: string }) => a.title === 'Dept A only')).toBe(false);
  });

  it('updates and deactivates an announcement', async () => {
    const { accessToken } = await createUserWithRole('hospital_admin');
    const created = await request(app)
      .post('/api/v1/announcements')
      .set(authHeader(accessToken))
      .send({ title: 'Original', body: 'x', scope: 'hospital' });

    const updated = await request(app)
      .put(`/api/v1/announcements/${created.body.data.id}`)
      .set(authHeader(accessToken))
      .send({ title: 'Updated', priority: 'emergency' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe('Updated');
    expect(updated.body.data.priority).toBe('emergency');

    const deactivated = await request(app)
      .delete(`/api/v1/announcements/${created.body.data.id}`)
      .set(authHeader(accessToken));
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.isActive).toBe(false);

    const { accessToken: employeeToken } = await makeLinkedEmployeeUser();
    const list = await request(app).get('/api/v1/announcements').set(authHeader(employeeToken));
    expect(list.body.data.some((a: { title: string }) => a.title === 'Updated')).toBe(false);
  });

  it('denies creating an announcement without announcement:manage', async () => {
    const { accessToken } = await makeLinkedEmployeeUser();
    const res = await request(app)
      .post('/api/v1/announcements')
      .set(authHeader(accessToken))
      .send({ title: 'x', body: 'y', scope: 'hospital' });
    expect(res.status).toBe(403);
  });
});
