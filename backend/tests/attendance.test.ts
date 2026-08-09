import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader, makeLinkedEmployeeUser } from './helpers/auth';
import { makeDepartment, makeSchedule, makeShift } from './helpers/factories';
import { ShiftAssignment } from '../src/models/ShiftAssignment.model';
import { Attendance } from '../src/models/Attendance.model';
import { signAccessToken } from '../src/utils/jwt';

// A fixed, safe mid-day moment — avoids any midnight/day-wrap edge cases when
// constructing shift times as offsets from "now".
const FIXED_NOW = new Date('2030-01-15T12:00:00.000Z');

function useFixedClock() {
  beforeEach(() => {
    // Fake ONLY the Date/Date.now implementation — real timers stay real, so
    // supertest/mongoose network I/O (which relies on actual setTimeout under
    // the hood) is unaffected.
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setInterval', 'setTimeout', 'queueMicrotask'] });
    jest.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });
}

describe('Attendance API', () => {
  describe('clock-in / clock-out (self-service)', () => {
    it('lets an employee clock themselves in and out, computing hours worked', async () => {
      const { accessToken } = await makeLinkedEmployeeUser();

      const clockIn = await request(app)
        .post('/api/v1/attendance/clock-in')
        .set(authHeader(accessToken))
        .send({ method: 'manual' });
      expect(clockIn.status).toBe(200);
      expect(clockIn.body.data.status).toBe('present');

      const clockOut = await request(app)
        .post('/api/v1/attendance/clock-out')
        .set(authHeader(accessToken))
        .send({ method: 'manual' });
      expect(clockOut.status).toBe(200);
      expect(typeof clockOut.body.data.totalHoursWorked).toBe('number');
    });

    it('rejects a second clock-in on the same day', async () => {
      const { accessToken } = await makeLinkedEmployeeUser();
      await request(app).post('/api/v1/attendance/clock-in').set(authHeader(accessToken)).send({ method: 'manual' });

      const res = await request(app)
        .post('/api/v1/attendance/clock-in')
        .set(authHeader(accessToken))
        .send({ method: 'manual' });
      expect(res.status).toBe(409);
    });

    it('rejects clocking out without an active clock-in', async () => {
      const { accessToken } = await makeLinkedEmployeeUser();
      const res = await request(app)
        .post('/api/v1/attendance/clock-out')
        .set(authHeader(accessToken))
        .send({ method: 'manual' });
      expect(res.status).toBe(400);
    });

    it('employees can only clock themselves in, not someone else', async () => {
      const { employee: other } = await makeLinkedEmployeeUser();
      const { accessToken } = await makeLinkedEmployeeUser();

      const res = await request(app)
        .post('/api/v1/attendance/clock-in')
        .set(authHeader(accessToken))
        .send({ employeeId: other.id, method: 'manual' });
      expect(res.status).toBe(403);
    });

    it('GET /today reflects live status through the clock-in/break/clock-out lifecycle', async () => {
      const { accessToken } = await makeLinkedEmployeeUser();

      const beforeClockIn = await request(app).get('/api/v1/attendance/today').set(authHeader(accessToken));
      expect(beforeClockIn.status).toBe(200);
      expect(beforeClockIn.body.data).toBeNull();

      await request(app).post('/api/v1/attendance/clock-in').set(authHeader(accessToken)).send({ method: 'manual' });
      const afterClockIn = await request(app).get('/api/v1/attendance/today').set(authHeader(accessToken));
      expect(afterClockIn.body.data.clockIn).toBeTruthy();
      expect(afterClockIn.body.data.clockOut).toBeFalsy();

      await request(app).post('/api/v1/attendance/break-start').set(authHeader(accessToken)).send({});
      const onBreak = await request(app).get('/api/v1/attendance/today').set(authHeader(accessToken));
      expect(onBreak.body.data.breaks).toHaveLength(1);
      expect(onBreak.body.data.breaks[0].end).toBeFalsy();

      await request(app).post('/api/v1/attendance/break-end').set(authHeader(accessToken)).send({});
      await request(app).post('/api/v1/attendance/clock-out').set(authHeader(accessToken)).send({ method: 'manual' });
      const afterClockOut = await request(app).get('/api/v1/attendance/today').set(authHeader(accessToken));
      expect(afterClockOut.body.data.clockOut).toBeTruthy();
    });

    it('HR (attendance:manage) can clock in on behalf of another employee', async () => {
      const { employee } = await makeLinkedEmployeeUser();
      const { accessToken: hrToken } = await createUserWithRole('hr_manager');

      const res = await request(app)
        .post('/api/v1/attendance/clock-in')
        .set(authHeader(hrToken))
        .send({ employeeId: employee.id, method: 'manual' });
      expect(res.status).toBe(200);
    });
  });

  describe('late detection against a scheduled shift', () => {
    useFixedClock();

    it('marks present when clocking in within the grace period of the scheduled start', async () => {
      const department = await makeDepartment();
      const { employee, accessToken } = await makeLinkedEmployeeUser({ department: department.id } as never);
      const schedule = await makeSchedule({ department: department.id });
      const shift = await makeShift({
        schedule: schedule.id,
        department: department.id,
        date: FIXED_NOW,
        startTime: '11:50', // 10 minutes before "now" — within the 15-min grace period
        endTime: '20:00',
      });
      await ShiftAssignment.create({ shift: shift.id, employee: employee.id, status: 'assigned' });

      const res = await request(app).post('/api/v1/attendance/clock-in').set(authHeader(accessToken)).send({ method: 'manual' });
      expect(res.body.data.status).toBe('present');
    });

    it('marks late when clocking in well past the scheduled start plus grace period', async () => {
      const department = await makeDepartment();
      const { employee, accessToken } = await makeLinkedEmployeeUser({ department: department.id } as never);
      const schedule = await makeSchedule({ department: department.id });
      const shift = await makeShift({
        schedule: schedule.id,
        department: department.id,
        date: FIXED_NOW,
        startTime: '10:00', // 2 hours before "now"
        endTime: '20:00',
      });
      await ShiftAssignment.create({ shift: shift.id, employee: employee.id, status: 'assigned' });

      const res = await request(app).post('/api/v1/attendance/clock-in').set(authHeader(accessToken)).send({ method: 'manual' });
      expect(res.body.data.status).toBe('late');
    });

    it('marks status overtime when hours worked exceed the scheduled shift duration', async () => {
      const department = await makeDepartment();
      const { employee, user } = await makeLinkedEmployeeUser({ department: department.id } as never);
      const schedule = await makeSchedule({ department: department.id });
      const shift = await makeShift({
        schedule: schedule.id,
        department: department.id,
        date: FIXED_NOW,
        startTime: '12:00',
        endTime: '12:30', // only a 30-minute shift
      });
      await ShiftAssignment.create({ shift: shift.id, employee: employee.id, status: 'assigned' });

      await request(app)
        .post('/api/v1/attendance/clock-in')
        .set(authHeader(signAccessToken({ sub: user.id, role: 'employee' })))
        .send({ method: 'manual' });

      jest.setSystemTime(new Date(FIXED_NOW.getTime() + 3 * 60 * 60 * 1000)); // worked 3 hours
      // A fresh token: the original would have genuinely expired after 3
      // simulated hours (access tokens last 15 minutes), same as in real use.
      const laterToken = signAccessToken({ sub: user.id, role: 'employee' });
      const clockOut = await request(app)
        .post('/api/v1/attendance/clock-out')
        .set(authHeader(laterToken))
        .send({ method: 'manual' });

      expect(clockOut.body.data.status).toBe('overtime');
      expect(clockOut.body.data.overtimeHours).toBeGreaterThan(0);
    });
  });

  describe('breaks', () => {
    it('tracks a break and excludes it from total hours worked', async () => {
      const { accessToken } = await makeLinkedEmployeeUser();
      await request(app).post('/api/v1/attendance/clock-in').set(authHeader(accessToken)).send({ method: 'manual' });

      const start = await request(app).post('/api/v1/attendance/break-start').set(authHeader(accessToken))
        .send({});
      expect(start.status).toBe(200);
      expect(start.body.data.breaks).toHaveLength(1);

      const doubleStart = await request(app).post('/api/v1/attendance/break-start').set(authHeader(accessToken))
        .send({});
      expect(doubleStart.status).toBe(409);

      const end = await request(app).post('/api/v1/attendance/break-end').set(authHeader(accessToken))
        .send({});
      expect(end.status).toBe(200);
      expect(end.body.data.breaks[0].end).toBeTruthy();

      const doubleEnd = await request(app).post('/api/v1/attendance/break-end').set(authHeader(accessToken))
        .send({});
      expect(doubleEnd.status).toBe(400);
    });

    it('rejects starting a break without an active clock-in', async () => {
      const { accessToken } = await makeLinkedEmployeeUser();
      const res = await request(app).post('/api/v1/attendance/break-start').set(authHeader(accessToken))
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('viewing records (attendance:view required)', () => {
    it('denies listing/summary without attendance:view', async () => {
      const { accessToken } = await makeLinkedEmployeeUser();
      const list = await request(app).get('/api/v1/attendance').set(authHeader(accessToken));
      expect(list.status).toBe(403);
    });

    it('lists attendance records with employee/date/status filters', async () => {
      const { employee, accessToken: employeeToken } = await makeLinkedEmployeeUser();
      await request(app).post('/api/v1/attendance/clock-in').set(authHeader(employeeToken)).send({ method: 'manual' });
      const { accessToken: hrToken } = await createUserWithRole('hr_manager');

      const res = await request(app).get(`/api/v1/attendance?employee=${employee.id}`).set(authHeader(hrToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('summarizes hours/attendance status counts for a date range', async () => {
      const { employee, accessToken: employeeToken } = await makeLinkedEmployeeUser();
      await request(app).post('/api/v1/attendance/clock-in').set(authHeader(employeeToken)).send({ method: 'manual' });
      const { accessToken: hrToken } = await createUserWithRole('hr_manager');

      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get(`/api/v1/attendance/summary?employee=${employee.id}&dateFrom=${today}&dateTo=${today}`)
        .set(authHeader(hrToken));

      expect(res.status).toBe(200);
      expect(res.body.data[0].presentDays).toBe(1);
      expect(res.body.data[0].totalRecords).toBe(1);
    });
  });

  describe('GET /mine (self-scoped, no attendance:view required)', () => {
    it('returns the caller\'s own records without attendance:view', async () => {
      const { accessToken } = await makeLinkedEmployeeUser();
      await request(app).post('/api/v1/attendance/clock-in').set(authHeader(accessToken)).send({ method: 'manual' });

      const res = await request(app).get('/api/v1/attendance/mine').set(authHeader(accessToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('present');
    });

    it('never returns another employee\'s records, even if an employee filter is somehow supplied', async () => {
      const { accessToken: employeeToken } = await makeLinkedEmployeeUser();
      const { accessToken: otherToken, employee: other } = await makeLinkedEmployeeUser();
      await request(app).post('/api/v1/attendance/clock-in').set(authHeader(otherToken)).send({ method: 'manual' });

      const res = await request(app)
        .get(`/api/v1/attendance/mine?employee=${other.id}`)
        .set(authHeader(employeeToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('rejects a caller with no linked employee profile', async () => {
      const { accessToken } = await createUserWithRole('hr_manager');
      const res = await request(app).get('/api/v1/attendance/mine').set(authHeader(accessToken));
      expect(res.status).toBe(400);
    });
  });

  describe('mark-absentees', () => {
    useFixedClock();

    it('marks employees absent if scheduled today but never clocked in, skipping those who did', async () => {
      const department = await makeDepartment();
      const { employee: noShow } = await makeLinkedEmployeeUser({ department: department.id } as never);
      const { employee: showedUp, accessToken: showedUpToken } = await makeLinkedEmployeeUser({
        department: department.id,
      } as never);
      const schedule = await makeSchedule({ department: department.id });
      const shift1 = await makeShift({ schedule: schedule.id, department: department.id, date: FIXED_NOW, startTime: '11:50', endTime: '20:00' });
      const shift2 = await makeShift({ schedule: schedule.id, department: department.id, date: FIXED_NOW, startTime: '11:50', endTime: '20:00' });
      await ShiftAssignment.create({ shift: shift1.id, employee: noShow.id, status: 'assigned' });
      await ShiftAssignment.create({ shift: shift2.id, employee: showedUp.id, status: 'assigned' });

      await request(app).post('/api/v1/attendance/clock-in').set(authHeader(showedUpToken)).send({ method: 'manual' });

      const { accessToken: hrToken } = await createUserWithRole('hr_manager');
      const res = await request(app).post('/api/v1/attendance/mark-absentees').set(authHeader(hrToken)).send({});
      expect(res.status).toBe(200);
      expect(res.body.data.marked).toBe(1);

      const noShowRecord = await Attendance.findOne({ employee: noShow.id });
      expect(noShowRecord!.status).toBe('absent');

      const showedUpRecord = await Attendance.findOne({ employee: showedUp.id });
      expect(showedUpRecord!.status).toBe('present');
    });

    it('denies mark-absentees without attendance:manage', async () => {
      const { accessToken } = await makeLinkedEmployeeUser();
      const res = await request(app).post('/api/v1/attendance/mark-absentees').set(authHeader(accessToken)).send({});
      expect(res.status).toBe(403);
    });
  });
});
