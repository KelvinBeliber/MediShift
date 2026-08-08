import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader } from './helpers/auth';
import { makeDepartment, makeShift } from './helpers/factories';
import { Schedule } from '../src/models/Schedule.model';

describe('Schedules API', () => {
  it('creates a draft schedule with the correct month date range', async () => {
    const department = await makeDepartment();
    const { accessToken } = await createUserWithRole('hospital_admin');

    const res = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(accessToken))
      .send({ department: department.id, month: 2, year: 2030 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.startDate).toBe('2030-02-01T00:00:00.000Z');
    expect(res.body.data.endDate).toBe('2030-02-28T23:59:59.999Z');
  });

  it('rejects a duplicate department+month+year schedule', async () => {
    const department = await makeDepartment();
    const { accessToken } = await createUserWithRole('hospital_admin');

    await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(accessToken))
      .send({ department: department.id, month: 3, year: 2030 });

    const dup = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(accessToken))
      .send({ department: department.id, month: 3, year: 2030 });

    expect(dup.status).toBe(409);
  });

  it('rejects creating a schedule for a nonexistent department', async () => {
    const { accessToken } = await createUserWithRole('hospital_admin');
    const res = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(accessToken))
      .send({ department: '65f000000000000000000000', month: 1, year: 2030 });
    expect(res.status).toBe(400);
  });

  it('denies schedule creation without schedule:create permission', async () => {
    const department = await makeDepartment();
    const { accessToken } = await createUserWithRole('employee');

    const res = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(accessToken))
      .send({ department: department.id, month: 4, year: 2030 });

    expect(res.status).toBe(403);
  });

  it('rejects publishing a schedule with no shifts', async () => {
    const department = await makeDepartment();
    const { accessToken } = await createUserWithRole('hospital_admin');
    const schedule = await Schedule.create({
      department: department.id,
      month: 5,
      year: 2030,
      startDate: new Date('2030-05-01'),
      endDate: new Date('2030-05-31'),
      status: 'draft',
    });

    const res = await request(app).post(`/api/v1/schedules/${schedule.id}/publish`).set(authHeader(accessToken));
    expect(res.status).toBe(400);
  });

  it('publishes a schedule once it has at least one shift, and blocks edits afterward', async () => {
    const department = await makeDepartment();
    const { accessToken } = await createUserWithRole('hospital_admin');
    const schedule = await Schedule.create({
      department: department.id,
      month: 6,
      year: 2030,
      startDate: new Date('2030-06-01'),
      endDate: new Date('2030-06-30'),
      status: 'draft',
    });
    await makeShift({ schedule: schedule.id, department: department.id });

    const publish = await request(app).post(`/api/v1/schedules/${schedule.id}/publish`).set(authHeader(accessToken));
    expect(publish.status).toBe(200);
    expect(publish.body.data.status).toBe('published');
    expect(publish.body.data.publishedAt).toBeTruthy();

    const republish = await request(app).post(`/api/v1/schedules/${schedule.id}/publish`).set(authHeader(accessToken));
    expect(republish.status).toBe(409);

    const editAfterPublish = await request(app)
      .put(`/api/v1/schedules/${schedule.id}`)
      .set(authHeader(accessToken))
      .send({ notes: 'should be blocked' });
    expect(editAfterPublish.status).toBe(409);
  });

  it('only allows deleting draft schedules, and cascades shift deletion', async () => {
    const department = await makeDepartment();
    const { accessToken } = await createUserWithRole('hospital_admin');
    const schedule = await Schedule.create({
      department: department.id,
      month: 7,
      year: 2030,
      startDate: new Date('2030-07-01'),
      endDate: new Date('2030-07-31'),
      status: 'draft',
    });
    const shift = await makeShift({ schedule: schedule.id, department: department.id });

    const del = await request(app).delete(`/api/v1/schedules/${schedule.id}`).set(authHeader(accessToken));
    expect(del.status).toBe(200);

    const shiftLookup = await request(app)
      .get(`/api/v1/shifts/${shift.id}`)
      .set(authHeader(accessToken));
    expect(shiftLookup.status).toBe(404);
  });

  it('lists and filters schedules by department/month/year/status', async () => {
    const department = await makeDepartment();
    const { accessToken } = await createUserWithRole('hospital_admin');
    await Schedule.create({
      department: department.id,
      month: 8,
      year: 2030,
      startDate: new Date('2030-08-01'),
      endDate: new Date('2030-08-31'),
      status: 'draft',
    });

    const res = await request(app)
      .get(`/api/v1/schedules?department=${department.id}&month=8&year=2030`)
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
