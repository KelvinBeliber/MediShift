import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader } from './helpers/auth';
import { makeDepartment, makeEmployee, makeShift, makeSchedule } from './helpers/factories';
import { Shift } from '../src/models/Shift.model';
import { ShiftAssignment } from '../src/models/ShiftAssignment.model';
import { Schedule } from '../src/models/Schedule.model';
import * as schedulingClient from '../src/services/scheduling/schedulingClient';

jest.mock('../src/services/scheduling/schedulingClient');

const mockedRequestGeneration = schedulingClient.requestScheduleGeneration as jest.MockedFunction<
  typeof schedulingClient.requestScheduleGeneration
>;

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

describe('POST /schedules/:id/generate', () => {
  it('auto-creates shift slots from department staffing requirements (weekday-only types skip weekends)', async () => {
    const start = new Date('2030-06-01');
    const end = new Date('2030-06-07');
    const department = await makeDepartment({
      staffingRequirements: [{ shiftType: 'morning', minStaff: 2, requiredCertifications: [] }] as never,
    });
    await makeEmployee({ department: department.id });
    const schedule = await makeSchedule({ department: department.id, startDate: start, endDate: end });
    const { accessToken } = await createUserWithRole('shift_coordinator');

    mockedRequestGeneration.mockResolvedValue({
      status: 'OPTIMAL',
      assignments: [],
      unfilledShifts: [],
      stats: { solveTimeSeconds: 0.01, totalShifts: 0, totalEmployees: 1, totalAssignments: 0, coveragePercent: 0 },
      message: 'ok',
    });

    const res = await request(app).post(`/api/v1/schedules/${schedule.id}/generate`).set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const expectedWeekdayShifts = countWeekdays(start, end);
    const shiftCount = await Shift.countDocuments({ schedule: schedule.id });
    expect(shiftCount).toBe(expectedWeekdayShifts);

    const updatedSchedule = await Schedule.findById(schedule.id);
    expect(updatedSchedule!.status).toBe('generated');
  });

  it('persists solver assignments as AI-generated and records solver stats on the schedule', async () => {
    const department = await makeDepartment();
    const employee = await makeEmployee({ department: department.id });
    const schedule = await makeSchedule({ department: department.id });
    const shift = await makeShift({ schedule: schedule.id, department: department.id });
    const { accessToken } = await createUserWithRole('shift_coordinator');

    mockedRequestGeneration.mockResolvedValue({
      status: 'OPTIMAL',
      assignments: [{ shiftId: shift.id, employeeId: employee.id }],
      unfilledShifts: [],
      stats: {
        solveTimeSeconds: 0.05,
        objectiveValue: 1000,
        totalShifts: 1,
        totalEmployees: 1,
        totalAssignments: 1,
        coveragePercent: 100,
      },
      message: 'Solved',
    });

    const res = await request(app).post(`/api/v1/schedules/${schedule.id}/generate`).set(authHeader(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.generation.status).toBe('OPTIMAL');

    const assignment = await ShiftAssignment.findOne({ shift: shift.id, employee: employee.id });
    expect(assignment).not.toBeNull();
    expect(assignment!.isAiGenerated).toBe(true);

    const updatedSchedule = await Schedule.findById(schedule.id);
    expect((updatedSchedule!.stats as Record<string, unknown>).coveragePercent).toBe(100);
  });

  it('replaces prior AI-generated assignments on regeneration but preserves manual ones', async () => {
    const department = await makeDepartment();
    const employeeA = await makeEmployee({ department: department.id });
    const employeeB = await makeEmployee({ department: department.id });
    const schedule = await makeSchedule({ department: department.id });
    const aiShift = await makeShift({ schedule: schedule.id, department: department.id, requiredStaff: 2 });
    const manualShift = await makeShift({ schedule: schedule.id, department: department.id, requiredStaff: 1 });
    const { accessToken } = await createUserWithRole('shift_coordinator');

    // A manual assignment made by a human, unrelated to the solver.
    await ShiftAssignment.create({ shift: manualShift.id, employee: employeeA.id, isAiGenerated: false });

    mockedRequestGeneration.mockResolvedValue({
      status: 'OPTIMAL',
      assignments: [{ shiftId: aiShift.id, employeeId: employeeA.id }],
      unfilledShifts: [],
      stats: { solveTimeSeconds: 0.01, totalShifts: 2, totalEmployees: 2, totalAssignments: 1, coveragePercent: 50 },
      message: 'ok',
    });
    await request(app).post(`/api/v1/schedules/${schedule.id}/generate`).set(authHeader(accessToken));

    let aiAssignments = await ShiftAssignment.find({ shift: aiShift.id });
    expect(aiAssignments).toHaveLength(1);
    expect(aiAssignments[0].employee.toString()).toBe(employeeA.id);

    // Regenerate with a different assignment for the same shift.
    mockedRequestGeneration.mockResolvedValue({
      status: 'OPTIMAL',
      assignments: [{ shiftId: aiShift.id, employeeId: employeeB.id }],
      unfilledShifts: [],
      stats: { solveTimeSeconds: 0.01, totalShifts: 2, totalEmployees: 2, totalAssignments: 1, coveragePercent: 50 },
      message: 'ok',
    });
    await request(app).post(`/api/v1/schedules/${schedule.id}/generate`).set(authHeader(accessToken));

    aiAssignments = await ShiftAssignment.find({ shift: aiShift.id });
    expect(aiAssignments).toHaveLength(1);
    expect(aiAssignments[0].employee.toString()).toBe(employeeB.id);

    // The manual assignment on the other shift must still be there, untouched.
    const manualAssignments = await ShiftAssignment.find({ shift: manualShift.id });
    expect(manualAssignments).toHaveLength(1);
    expect(manualAssignments[0].isAiGenerated).toBe(false);
  });

  it('reverts the schedule to draft status if the solver call fails', async () => {
    const department = await makeDepartment();
    await makeEmployee({ department: department.id });
    const schedule = await makeSchedule({ department: department.id });
    await makeShift({ schedule: schedule.id, department: department.id });
    const { accessToken } = await createUserWithRole('shift_coordinator');

    mockedRequestGeneration.mockRejectedValue(new Error('Scheduling service unreachable'));

    const res = await request(app).post(`/api/v1/schedules/${schedule.id}/generate`).set(authHeader(accessToken));
    expect(res.status).toBeGreaterThanOrEqual(500);

    const updatedSchedule = await Schedule.findById(schedule.id);
    expect(updatedSchedule!.status).toBe('draft');
  });

  it('rejects generation when the department has no active employees', async () => {
    const department = await makeDepartment();
    const schedule = await makeSchedule({ department: department.id });
    await makeShift({ schedule: schedule.id, department: department.id });
    const { accessToken } = await createUserWithRole('shift_coordinator');

    const res = await request(app).post(`/api/v1/schedules/${schedule.id}/generate`).set(authHeader(accessToken));
    expect(res.status).toBe(400);
    expect(mockedRequestGeneration).not.toHaveBeenCalled();
  });

  it('rejects generation when there are no shifts and no staffing requirements to build them from', async () => {
    const department = await makeDepartment();
    await makeEmployee({ department: department.id });
    const schedule = await makeSchedule({ department: department.id });
    const { accessToken } = await createUserWithRole('shift_coordinator');

    const res = await request(app).post(`/api/v1/schedules/${schedule.id}/generate`).set(authHeader(accessToken));
    expect(res.status).toBe(400);
  });

  it('denies generation without schedule:generate permission', async () => {
    const department = await makeDepartment();
    const schedule = await makeSchedule({ department: department.id });
    const { accessToken } = await createUserWithRole('employee');

    const res = await request(app).post(`/api/v1/schedules/${schedule.id}/generate`).set(authHeader(accessToken));
    expect(res.status).toBe(403);
    expect(mockedRequestGeneration).not.toHaveBeenCalled();
  });
});
