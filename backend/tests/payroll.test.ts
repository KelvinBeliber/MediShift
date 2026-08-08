import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader, makeLinkedEmployeeUser } from './helpers/auth';
import { makeDepartment, makeSchedule, makeShift } from './helpers/factories';
import { Attendance } from '../src/models/Attendance.model';

const PERIOD_START = '2030-04-01';
const PERIOD_END = '2030-04-30';

describe('Payroll API', () => {
  it('computes hours, overtime, night differential, tardiness, undertime, and absences from attendance records', async () => {
    const department = await makeDepartment();
    const { employee } = await makeLinkedEmployeeUser({ department: department.id } as never);
    const schedule = await makeSchedule({ department: department.id, month: 4, year: 2030 });

    // An 8-hour night shift (22:00 -> 06:00) on April 10th.
    const nightShift = await makeShift({
      schedule: schedule.id,
      department: department.id,
      date: new Date('2030-04-10'),
      shiftType: 'night',
      startTime: '22:00',
      endTime: '06:00',
    });

    // Clocked in 20 minutes late (5 min over the 15-min grace period) and left
    // 30 minutes early (7.5h worked against an 8h shift).
    await Attendance.create({
      employee: employee.id,
      shift: nightShift.id,
      date: new Date('2030-04-10'),
      clockIn: { time: new Date('2030-04-10T22:20:00.000Z'), method: 'manual' },
      clockOut: { time: new Date('2030-04-11T05:30:00.000Z'), method: 'manual' },
      status: 'late',
      totalHoursWorked: 7.5,
      overtimeHours: 0,
    });

    // A separate no-show day.
    await Attendance.create({
      employee: employee.id,
      date: new Date('2030-04-15'),
      status: 'absent',
    });

    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .post('/api/v1/payroll/generate')
      .set(authHeader(accessToken))
      .send({ periodStart: PERIOD_START, periodEnd: PERIOD_END, department: department.id });

    expect(res.status).toBe(200);
    const payroll = res.body.data.find((p: { employee: string }) => p.employee === employee.id);
    expect(payroll).toBeDefined();
    expect(payroll.totalHoursWorked).toBe(7.5);
    expect(payroll.regularHours).toBe(7.5);
    expect(payroll.overtimeHours).toBe(0);
    expect(payroll.nightDifferentialHours).toBe(7.5);
    expect(payroll.tardinessMinutes).toBe(5);
    expect(payroll.undertimeMinutes).toBe(30);
    expect(payroll.absences).toBe(1);
    expect(payroll.status).toBe('draft');
  });

  it('regenerating for the same period upserts rather than duplicates', async () => {
    const department = await makeDepartment();
    await makeLinkedEmployeeUser({ department: department.id } as never);
    const { accessToken } = await createUserWithRole('hr_manager');

    await request(app)
      .post('/api/v1/payroll/generate')
      .set(authHeader(accessToken))
      .send({ periodStart: PERIOD_START, periodEnd: PERIOD_END, department: department.id });
    await request(app)
      .post('/api/v1/payroll/generate')
      .set(authHeader(accessToken))
      .send({ periodStart: PERIOD_START, periodEnd: PERIOD_END, department: department.id });

    const list = await request(app)
      .get(`/api/v1/payroll?periodStart=${PERIOD_START}`)
      .set(authHeader(accessToken));
    expect(list.body.data).toHaveLength(1);
  });

  it('finalizes a payroll input', async () => {
    const department = await makeDepartment();
    await makeLinkedEmployeeUser({ department: department.id } as never);
    const { accessToken } = await createUserWithRole('hr_manager');

    const generated = await request(app)
      .post('/api/v1/payroll/generate')
      .set(authHeader(accessToken))
      .send({ periodStart: PERIOD_START, periodEnd: PERIOD_END, department: department.id });
    const payrollId = generated.body.data[0].id;

    const finalized = await request(app).put(`/api/v1/payroll/${payrollId}/finalize`).set(authHeader(accessToken));
    expect(finalized.status).toBe(200);
    expect(finalized.body.data.status).toBe('finalized');
  });

  it('exports payroll as CSV with a header row and employee data', async () => {
    const department = await makeDepartment();
    const { employee } = await makeLinkedEmployeeUser({ department: department.id } as never);
    const { accessToken } = await createUserWithRole('hr_manager');

    await request(app)
      .post('/api/v1/payroll/generate')
      .set(authHeader(accessToken))
      .send({ periodStart: PERIOD_START, periodEnd: PERIOD_END, department: department.id });

    const csv = await request(app)
      .get(`/api/v1/payroll/export?periodStart=${PERIOD_START}&periodEnd=${PERIOD_END}`)
      .set(authHeader(accessToken));

    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    const lines = csv.text.trim().split('\n');
    expect(lines[0]).toBe(
      'Employee ID,Employee Name,Total Hours,Regular Hours,Overtime Hours,Night Differential Hours,Holiday Hours,Tardiness (min),Undertime (min),Absences,Status'
    );
    expect(lines.some((line) => line.includes(employee.employeeId))).toBe(true);
  });

  it('denies payroll generation/export without the right permissions', async () => {
    const { accessToken } = await makeLinkedEmployeeUser();

    const generate = await request(app)
      .post('/api/v1/payroll/generate')
      .set(authHeader(accessToken))
      .send({ periodStart: PERIOD_START, periodEnd: PERIOD_END });
    expect(generate.status).toBe(403);

    const list = await request(app).get('/api/v1/payroll').set(authHeader(accessToken));
    expect(list.status).toBe(403);
  });
});
