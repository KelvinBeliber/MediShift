import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader, makeLinkedEmployeeUser } from './helpers/auth';
import { makeDepartment, makeSchedule, makeShift } from './helpers/factories';
import { Attendance } from '../src/models/Attendance.model';
import { LeaveRequest } from '../src/models/LeaveRequest.model';
import { ShiftAssignment } from '../src/models/ShiftAssignment.model';

describe('Reports & Analytics API', () => {
  it('attendance-trends aggregates status counts per day', async () => {
    const { employee } = await makeLinkedEmployeeUser();
    const { employee: employee2 } = await makeLinkedEmployeeUser();
    await Attendance.create({ employee: employee.id, date: new Date('2030-05-01'), status: 'present', totalHoursWorked: 8 });
    await Attendance.create({ employee: employee.id, date: new Date('2030-05-02'), status: 'late', totalHoursWorked: 7 });
    await Attendance.create({ employee: employee2.id, date: new Date('2030-05-02'), status: 'absent' } as never);

    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .get('/api/v1/reports/attendance-trends?dateFrom=2030-05-01&dateTo=2030-05-02')
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const day1 = res.body.data.find((d: { date: string }) => d.date === '2030-05-01');
    const day2 = res.body.data.find((d: { date: string }) => d.date === '2030-05-02');
    expect(day1.present).toBe(1);
    expect(day2.late).toBe(1);
    expect(day2.absent).toBe(1);
  });

  it('leave-statistics breaks down requests by type and status', async () => {
    const { employee } = await makeLinkedEmployeeUser();
    await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'vacation',
      startDate: new Date('2030-06-01'),
      endDate: new Date('2030-06-02'),
      totalDays: 2,
      status: 'approved',
    });
    await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'vacation',
      startDate: new Date('2030-06-10'),
      endDate: new Date('2030-06-10'),
      totalDays: 1,
      status: 'pending',
    });
    await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'sick',
      startDate: new Date('2030-06-15'),
      endDate: new Date('2030-06-15'),
      totalDays: 1,
      status: 'approved',
    });

    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .get('/api/v1/reports/leave-statistics?dateFrom=2030-06-01&dateTo=2030-06-30')
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const vacation = res.body.data.find((r: { leaveType: string }) => r.leaveType === 'vacation');
    const sick = res.body.data.find((r: { leaveType: string }) => r.leaveType === 'sick');
    expect(vacation.total).toBe(2);
    expect(vacation.byStatus.approved).toBe(1);
    expect(vacation.byStatus.pending).toBe(1);
    expect(sick.total).toBe(1);
  });

  it('overtime-trends sums overtime hours per day', async () => {
    const { employee: e1 } = await makeLinkedEmployeeUser();
    const { employee: e2 } = await makeLinkedEmployeeUser();
    await Attendance.create({ employee: e1.id, date: new Date('2030-07-01'), status: 'overtime', totalHoursWorked: 10, overtimeHours: 2 });
    await Attendance.create({ employee: e2.id, date: new Date('2030-07-01'), status: 'present', totalHoursWorked: 8, overtimeHours: 0 });

    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .get('/api/v1/reports/overtime-trends?dateFrom=2030-07-01&dateTo=2030-07-01')
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].overtimeHours).toBe(2);
  });

  it('shift-coverage reports required vs. assigned staffing per day', async () => {
    const department = await makeDepartment();
    const schedule = await makeSchedule({ department: department.id });
    const { employee } = await makeLinkedEmployeeUser({ department: department.id } as never);
    const shift = await makeShift({
      schedule: schedule.id,
      department: department.id,
      date: new Date('2030-08-01'),
      requiredStaff: 2,
    });
    await ShiftAssignment.create({ shift: shift.id, employee: employee.id, status: 'assigned' });

    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .get(`/api/v1/reports/shift-coverage?dateFrom=2030-08-01&dateTo=2030-08-01&department=${department.id}`)
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data[0].requiredStaff).toBe(2);
    expect(res.body.data[0].assignedStaff).toBe(1);
    expect(res.body.data[0].coveragePercent).toBe(50);
  });

  it('department-utilization compares worked vs scheduled hours', async () => {
    const department = await makeDepartment();
    const schedule = await makeSchedule({ department: department.id });
    const { employee } = await makeLinkedEmployeeUser({ department: department.id } as never);
    await makeShift({
      schedule: schedule.id,
      department: department.id,
      date: new Date('2030-09-01'),
      startTime: '08:00',
      endTime: '16:00', // 8h scheduled
      requiredStaff: 1,
    });
    await Attendance.create({ employee: employee.id, date: new Date('2030-09-01'), status: 'present', totalHoursWorked: 4 });

    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .get('/api/v1/reports/department-utilization?dateFrom=2030-09-01&dateTo=2030-09-01')
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const row = res.body.data.find((d: { departmentId: string }) => d.departmentId === department.id);
    expect(row.workedHours).toBe(4);
    expect(row.scheduledHours).toBe(8);
    expect(row.utilizationPercent).toBe(50);
  });

  it('dashboard returns a summary shape without error even with no data', async () => {
    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app).get('/api/v1/reports/dashboard').set(authHeader(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('attendancePercent');
    expect(res.body.data).toHaveProperty('upcomingCoveragePercent');
    expect(res.body.data).toHaveProperty('openShiftsNext14Days');
  });

  it('denies report access without report:view or analytics:view', async () => {
    const { accessToken } = await makeLinkedEmployeeUser();
    const res = await request(app)
      .get('/api/v1/reports/dashboard')
      .set(authHeader(accessToken));
    expect(res.status).toBe(403);
  });
});
