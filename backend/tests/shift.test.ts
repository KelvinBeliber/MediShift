import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader } from './helpers/auth';
import { makeDepartment, makeSchedule, makeShift, makeEmployee, makeCertification } from './helpers/factories';
import { Schedule } from '../src/models/Schedule.model';

describe('Shifts & Assignments API', () => {
  it('creates a shift under a schedule, defaulting department from the schedule', async () => {
    const department = await makeDepartment();
    const schedule = await makeSchedule({ department: department.id });
    const { accessToken } = await createUserWithRole('shift_coordinator');

    const res = await request(app)
      .post('/api/v1/shifts')
      .set(authHeader(accessToken))
      .send({
        schedule: schedule.id,
        date: '2030-06-05',
        shiftType: 'morning',
        startTime: '07:00',
        endTime: '15:00',
        requiredStaff: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.department).toBe(department.id);
  });

  it('blocks shift creation/editing once the schedule is published', async () => {
    const department = await makeDepartment();
    const schedule = await makeSchedule({ department: department.id });
    await makeShift({ schedule: schedule.id, department: department.id });
    await Schedule.findByIdAndUpdate(schedule.id, { status: 'published' });
    const { accessToken } = await createUserWithRole('shift_coordinator');

    const res = await request(app)
      .post('/api/v1/shifts')
      .set(authHeader(accessToken))
      .send({
        schedule: schedule.id,
        date: '2030-06-06',
        shiftType: 'morning',
        startTime: '07:00',
        endTime: '15:00',
        requiredStaff: 1,
      });

    expect(res.status).toBe(409);
  });

  describe('assigning employees to shifts', () => {
    async function setup() {
      const department = await makeDepartment();
      const schedule = await makeSchedule({ department: department.id });
      const { accessToken } = await createUserWithRole('shift_coordinator');
      return { department, schedule, accessToken };
    }

    it('assigns an eligible employee successfully', async () => {
      const { department, schedule, accessToken } = await setup();
      const employee = await makeEmployee({ department: department.id });
      const shift = await makeShift({ schedule: schedule.id, department: department.id, requiredStaff: 1 });

      const res = await request(app)
        .post(`/api/v1/shifts/${shift.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('assigned');
    });

    it('rejects assignment when the employee lacks a required certification', async () => {
      const { department, schedule, accessToken } = await setup();
      const cert = await makeCertification({ name: 'ICU Certified', code: 'ICU' });
      const employee = await makeEmployee({ department: department.id }); // no certifications
      const shift = await makeShift({
        schedule: schedule.id,
        department: department.id,
        requiredCertifications: [cert.id],
      });

      const res = await request(app)
        .post(`/api/v1/shifts/${shift.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/certification/i);
    });

    it('allows assignment when the employee holds the required, unexpired certification', async () => {
      const { department, schedule, accessToken } = await setup();
      const cert = await makeCertification({ name: 'ICU Certified', code: 'ICU2' });
      const employee = await makeEmployee({
        department: department.id,
        certifications: [{ certification: cert._id }] as never,
      });
      const shift = await makeShift({
        schedule: schedule.id,
        department: department.id,
        requiredCertifications: [cert.id],
      });

      const res = await request(app)
        .post(`/api/v1/shifts/${shift.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });

      expect(res.status).toBe(201);
    });

    it('rejects assignment once the shift is fully staffed', async () => {
      const { department, schedule, accessToken } = await setup();
      const shift = await makeShift({ schedule: schedule.id, department: department.id, requiredStaff: 1 });
      const e1 = await makeEmployee({ department: department.id });
      const e2 = await makeEmployee({ department: department.id });

      const first = await request(app)
        .post(`/api/v1/shifts/${shift.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: e1.id });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/v1/shifts/${shift.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: e2.id });
      expect(second.status).toBe(409);
      expect(second.body.message).toMatch(/fully staffed/i);
    });

    it('rejects a duplicate assignment of the same employee to the same shift', async () => {
      const { department, schedule, accessToken } = await setup();
      const shift = await makeShift({ schedule: schedule.id, department: department.id, requiredStaff: 5 });
      const employee = await makeEmployee({ department: department.id });

      await request(app)
        .post(`/api/v1/shifts/${shift.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });

      const dup = await request(app)
        .post(`/api/v1/shifts/${shift.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });

      expect(dup.status).toBe(409);
    });

    it('rejects overlapping same-day shifts for the same employee', async () => {
      const { department, schedule, accessToken } = await setup();
      const employee = await makeEmployee({ department: department.id });
      const shift1 = await makeShift({
        schedule: schedule.id,
        department: department.id,
        date: new Date('2030-06-10'),
        startTime: '07:00',
        endTime: '15:00',
      });
      const shift2 = await makeShift({
        schedule: schedule.id,
        department: department.id,
        date: new Date('2030-06-10'),
        startTime: '14:00',
        endTime: '22:00',
      });

      const first = await request(app)
        .post(`/api/v1/shifts/${shift1.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/v1/shifts/${shift2.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });
      expect(second.status).toBe(409);
      expect(second.body.message).toMatch(/overlapping/i);
    });

    it('correctly detects overlap across an overnight shift boundary', async () => {
      const { department, schedule, accessToken } = await setup();
      const employee = await makeEmployee({ department: department.id });
      // Night shift 20:00 -> 08:00 (crosses into the next calendar day)
      const nightShift = await makeShift({
        schedule: schedule.id,
        department: department.id,
        date: new Date('2030-06-11'),
        shiftType: 'night',
        startTime: '20:00',
        endTime: '08:00',
      });
      // Same calendar date as the night shift, but a time that only overlaps
      // because the night shift runs past midnight.
      const earlyMorningShift = await makeShift({
        schedule: schedule.id,
        department: department.id,
        date: new Date('2030-06-11'),
        shiftType: 'overtime',
        startTime: '22:00',
        endTime: '23:00',
      });

      const first = await request(app)
        .post(`/api/v1/shifts/${nightShift.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/v1/shifts/${earlyMorningShift.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });
      expect(second.status).toBe(409);
    });

    it('allows non-overlapping shifts on the same day for the same employee', async () => {
      const { department, schedule, accessToken } = await setup();
      const employee = await makeEmployee({ department: department.id });
      const morning = await makeShift({
        schedule: schedule.id,
        department: department.id,
        date: new Date('2030-06-12'),
        startTime: '07:00',
        endTime: '11:00',
      });
      const afternoon = await makeShift({
        schedule: schedule.id,
        department: department.id,
        date: new Date('2030-06-12'),
        shiftType: 'afternoon',
        startTime: '15:00',
        endTime: '23:00',
      });

      const first = await request(app)
        .post(`/api/v1/shifts/${morning.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/v1/shifts/${afternoon.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });
      expect(second.status).toBe(201);
    });

    it('rejects assigning an inactive employee', async () => {
      const { department, schedule, accessToken } = await setup();
      const employee = await makeEmployee({ department: department.id, status: 'terminated' });
      const shift = await makeShift({ schedule: schedule.id, department: department.id });

      const res = await request(app)
        .post(`/api/v1/shifts/${shift.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });

      expect(res.status).toBe(400);
    });

    it('updates and removes an assignment', async () => {
      const { department, schedule, accessToken } = await setup();
      const employee = await makeEmployee({ department: department.id });
      const shift = await makeShift({ schedule: schedule.id, department: department.id });

      const created = await request(app)
        .post(`/api/v1/shifts/${shift.id}/assignments`)
        .set(authHeader(accessToken))
        .send({ employeeId: employee.id });
      const assignmentId = created.body.data.id;

      const updated = await request(app)
        .put(`/api/v1/shifts/${shift.id}/assignments/${assignmentId}`)
        .set(authHeader(accessToken))
        .send({ status: 'confirmed' });
      expect(updated.status).toBe(200);
      expect(updated.body.data.status).toBe('confirmed');
      expect(updated.body.data.confirmedAt).toBeTruthy();

      const removed = await request(app)
        .delete(`/api/v1/shifts/${shift.id}/assignments/${assignmentId}`)
        .set(authHeader(accessToken));
      expect(removed.status).toBe(200);
    });
  });
});
