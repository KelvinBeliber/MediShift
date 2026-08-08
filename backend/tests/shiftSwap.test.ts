import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader, makeLinkedEmployeeUser } from './helpers/auth';
import { makeDepartment, makeSchedule, makeShift } from './helpers/factories';
import { ShiftAssignment } from '../src/models/ShiftAssignment.model';
import { ShiftSwapRequest } from '../src/models/ShiftSwapRequest.model';

async function setupTwoEmployeesWithShifts() {
  const department = await makeDepartment();
  const schedule = await makeSchedule({ department: department.id });
  const a = await makeLinkedEmployeeUser({ department: department.id } as never);
  const b = await makeLinkedEmployeeUser({ department: department.id } as never);
  const shiftA = await makeShift({ schedule: schedule.id, department: department.id, date: new Date('2030-06-10') });
  const shiftB = await makeShift({ schedule: schedule.id, department: department.id, date: new Date('2030-06-11') });
  await ShiftAssignment.create({ shift: shiftA.id, employee: a.employee.id, status: 'assigned' });
  await ShiftAssignment.create({ shift: shiftB.id, employee: b.employee.id, status: 'assigned' });
  return { department, schedule, a, b, shiftA, shiftB };
}

describe('Shift Swaps API', () => {
  it('rejects creating a swap for a shift the requester is not assigned to', async () => {
    const { a, shiftB } = await setupTwoEmployeesWithShifts();

    const res = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftB.id });

    expect(res.status).toBe(400);
  });

  it('creates a give-away swap request (no target shift)', async () => {
    const { a, b, shiftA } = await setupTwoEmployeesWithShifts();

    const res = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftA.id, targetEmployee: b.employee.id, reason: 'Doctor appointment' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  it('rejects a direct-swap request when the target employee does not hold the target shift', async () => {
    const { a, b, shiftA, shiftB } = await setupTwoEmployeesWithShifts();
    // Unassign b from shiftB so the direct swap should fail eligibility.
    await ShiftAssignment.deleteMany({ shift: shiftB.id });

    const res = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftA.id, targetEmployee: b.employee.id, targetShift: shiftB.id });

    expect(res.status).toBe(400);
  });

  it('only the directed target employee can accept; others are forbidden', async () => {
    const { a, b, shiftA } = await setupTwoEmployeesWithShifts();
    const { accessToken: strangerToken } = await makeLinkedEmployeeUser();

    const created = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftA.id, targetEmployee: b.employee.id });
    const swapId = created.body.data.id;

    const wrongAccept = await request(app).post(`/api/v1/shift-swaps/${swapId}/accept`).set(authHeader(strangerToken));
    expect(wrongAccept.status).toBe(403);

    const rightAccept = await request(app).post(`/api/v1/shift-swaps/${swapId}/accept`).set(authHeader(b.accessToken));
    expect(rightAccept.status).toBe(200);
    expect(rightAccept.body.data.status).toBe('accepted');
  });

  it('an open swap request (no directed target) can be claimed by whoever accepts it', async () => {
    const { a, b, shiftA } = await setupTwoEmployeesWithShifts();

    const created = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftA.id });
    const swapId = created.body.data.id;

    const accepted = await request(app).post(`/api/v1/shift-swaps/${swapId}/accept`).set(authHeader(b.accessToken));
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.targetEmployee).toBe(b.employee.id);
  });

  it('rejects manager approval before the target has accepted', async () => {
    const { a, b, shiftA } = await setupTwoEmployeesWithShifts();
    const { accessToken: managerToken } = await createUserWithRole('department_head');

    const created = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftA.id, targetEmployee: b.employee.id });
    const swapId = created.body.data.id;

    const res = await request(app).post(`/api/v1/shift-swaps/${swapId}/approve`).set(authHeader(managerToken));
    expect(res.status).toBe(409);
  });

  it('give-away swap: manager approval reassigns the shift to the target employee', async () => {
    const { a, b, shiftA } = await setupTwoEmployeesWithShifts();
    const { accessToken: managerToken } = await createUserWithRole('department_head');

    const created = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftA.id, targetEmployee: b.employee.id });
    const swapId = created.body.data.id;

    await request(app).post(`/api/v1/shift-swaps/${swapId}/accept`).set(authHeader(b.accessToken));
    const approved = await request(app).post(`/api/v1/shift-swaps/${swapId}/approve`).set(authHeader(managerToken));

    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('manager_approved');

    const assignment = await ShiftAssignment.findOne({ shift: shiftA.id });
    expect(assignment!.employee.toString()).toBe(b.employee.id);
  });

  it('direct swap: manager approval trades both shift assignments', async () => {
    const { a, b, shiftA, shiftB } = await setupTwoEmployeesWithShifts();
    const { accessToken: managerToken } = await createUserWithRole('department_head');

    const created = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftA.id, targetEmployee: b.employee.id, targetShift: shiftB.id });
    const swapId = created.body.data.id;

    await request(app).post(`/api/v1/shift-swaps/${swapId}/accept`).set(authHeader(b.accessToken));
    const approved = await request(app).post(`/api/v1/shift-swaps/${swapId}/approve`).set(authHeader(managerToken));
    expect(approved.status).toBe(200);

    const assignmentA = await ShiftAssignment.findOne({ shift: shiftA.id });
    const assignmentB = await ShiftAssignment.findOne({ shift: shiftB.id });
    expect(assignmentA!.employee.toString()).toBe(b.employee.id);
    expect(assignmentB!.employee.toString()).toBe(a.employee.id);
  });

  it('blocks approval if it would double-book the receiving employee', async () => {
    const { department, a, b, shiftA } = await setupTwoEmployeesWithShifts();
    const { accessToken: managerToken } = await createUserWithRole('department_head');

    // b is already working an overlapping shift at the same time as shiftA.
    // (A different month than the default, since setupTwoEmployeesWithShifts
    // already created a June 2030 schedule for this department.)
    const conflictingSchedule = await makeSchedule({ department: department.id, month: 7 });
    const shiftA2 = await makeShift({
      schedule: conflictingSchedule.id,
      department: department.id,
      date: shiftA.date,
      startTime: shiftA.startTime,
      endTime: shiftA.endTime,
    });
    await ShiftAssignment.create({ shift: shiftA2.id, employee: b.employee.id, status: 'assigned' });

    const created = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftA.id, targetEmployee: b.employee.id });
    const swapId = created.body.data.id;

    await request(app).post(`/api/v1/shift-swaps/${swapId}/accept`).set(authHeader(b.accessToken));
    const approved = await request(app).post(`/api/v1/shift-swaps/${swapId}/approve`).set(authHeader(managerToken));

    expect(approved.status).toBe(409);
  });

  it('rejects and cancels swap requests', async () => {
    const { a, b, shiftA } = await setupTwoEmployeesWithShifts();
    const { accessToken: managerToken } = await createUserWithRole('department_head');

    const created1 = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftA.id, targetEmployee: b.employee.id });
    const rejected = await request(app)
      .post(`/api/v1/shift-swaps/${created1.body.data.id}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: 'Coverage too thin that day' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('rejected');

    // Fresh assignment since the shift wasn't touched by the rejected swap.
    const created2 = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftA.id, targetEmployee: b.employee.id });
    const cancelled = await request(app)
      .post(`/api/v1/shift-swaps/${created2.body.data.id}/cancel`)
      .set(authHeader(a.accessToken));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('cancelled');
  });

  it('scopes the swap list to requests the caller is involved in by default', async () => {
    const { a, b, shiftA } = await setupTwoEmployeesWithShifts();
    const { accessToken: strangerToken } = await makeLinkedEmployeeUser();

    await ShiftSwapRequest.create({
      requestingEmployee: a.employee.id,
      requestingShift: shiftA.id,
      targetEmployee: b.employee.id,
      status: 'pending',
    });

    const strangerView = await request(app).get('/api/v1/shift-swaps').set(authHeader(strangerToken));
    expect(strangerView.body.data).toHaveLength(0);

    const aView = await request(app).get('/api/v1/shift-swaps').set(authHeader(a.accessToken));
    expect(aView.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('denies swap creation and approval without the right permissions', async () => {
    const { a, shiftA } = await setupTwoEmployeesWithShifts();

    // Regular employees can create/accept but not approve.
    const created = await request(app)
      .post('/api/v1/shift-swaps')
      .set(authHeader(a.accessToken))
      .send({ requestingShift: shiftA.id });
    expect(created.status).toBe(201);

    const approveAttempt = await request(app)
      .post(`/api/v1/shift-swaps/${created.body.data.id}/approve`)
      .set(authHeader(a.accessToken));
    expect(approveAttempt.status).toBe(403);
  });
});
