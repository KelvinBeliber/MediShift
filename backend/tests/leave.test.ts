import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader, makeLinkedEmployeeUser } from './helpers/auth';
import { makeDepartment, makeSchedule, makeShift } from './helpers/factories';
import { ShiftAssignment } from '../src/models/ShiftAssignment.model';
import { LeaveRequest } from '../src/models/LeaveRequest.model';

describe('Leave API', () => {
  it('lets an employee submit their own leave request', async () => {
    const { employee, accessToken } = await makeLinkedEmployeeUser();

    const res = await request(app)
      .post('/api/v1/leave')
      .set(authHeader(accessToken))
      .send({ leaveType: 'vacation', startDate: '2030-01-10', endDate: '2030-01-12', reason: 'Trip' });

    expect(res.status).toBe(201);
    expect(res.body.data.employee).toBe(employee.id);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.totalDays).toBe(3);
  });

  it('rejects an overlapping leave request for the same employee', async () => {
    const { employee, accessToken } = await makeLinkedEmployeeUser();
    await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'sick',
      startDate: new Date('2030-02-05'),
      endDate: new Date('2030-02-08'),
      totalDays: 4,
      status: 'pending',
    });

    const res = await request(app)
      .post('/api/v1/leave')
      .set(authHeader(accessToken))
      .send({ leaveType: 'vacation', startDate: '2030-02-07', endDate: '2030-02-10' });

    expect(res.status).toBe(409);
  });

  it('denies submitting a leave request on behalf of someone else without leave:approve', async () => {
    const { employee: otherEmployee } = await makeLinkedEmployeeUser();
    const { accessToken } = await makeLinkedEmployeeUser();

    const res = await request(app)
      .post('/api/v1/leave')
      .set(authHeader(accessToken))
      .send({
        employeeId: otherEmployee.id,
        leaveType: 'vacation',
        startDate: '2030-03-01',
        endDate: '2030-03-02',
      });

    expect(res.status).toBe(403);
  });

  it('allows HR to submit a leave request on behalf of an employee', async () => {
    const { employee } = await makeLinkedEmployeeUser();
    const { accessToken: hrToken } = await createUserWithRole('hr_manager');

    const res = await request(app)
      .post('/api/v1/leave')
      .set(authHeader(hrToken))
      .send({ employeeId: employee.id, leaveType: 'bereavement', startDate: '2030-03-01', endDate: '2030-03-02' });

    expect(res.status).toBe(201);
  });

  it('scopes the leave list to the requester unless they have leave:view', async () => {
    const { employee: e1, accessToken: e1Token } = await makeLinkedEmployeeUser();
    const { employee: e2 } = await makeLinkedEmployeeUser();
    await LeaveRequest.create({
      employee: e1.id,
      leaveType: 'vacation',
      startDate: new Date('2030-04-01'),
      endDate: new Date('2030-04-02'),
      totalDays: 2,
      status: 'pending',
    });
    await LeaveRequest.create({
      employee: e2.id,
      leaveType: 'sick',
      startDate: new Date('2030-04-05'),
      endDate: new Date('2030-04-06'),
      totalDays: 2,
      status: 'pending',
    });

    const ownList = await request(app).get('/api/v1/leave').set(authHeader(e1Token));
    expect(ownList.body.data).toHaveLength(1);
    expect(ownList.body.data[0].employee._id ?? ownList.body.data[0].employee.id).toBeTruthy();

    const { accessToken: hrToken } = await createUserWithRole('hr_manager');
    const fullList = await request(app).get('/api/v1/leave').set(authHeader(hrToken));
    expect(fullList.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('lets the owner cancel their own pending request, but not once approved', async () => {
    const { employee, accessToken } = await makeLinkedEmployeeUser();
    const leave = await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'vacation',
      startDate: new Date('2030-05-01'),
      endDate: new Date('2030-05-02'),
      totalDays: 2,
      status: 'pending',
    });

    const cancel = await request(app).post(`/api/v1/leave/${leave.id}/cancel`).set(authHeader(accessToken));
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('cancelled');

    const alreadyApproved = await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'vacation',
      startDate: new Date('2030-05-10'),
      endDate: new Date('2030-05-11'),
      totalDays: 2,
      status: 'approved',
    });
    const failedCancel = await request(app)
      .post(`/api/v1/leave/${alreadyApproved.id}/cancel`)
      .set(authHeader(accessToken));
    expect(failedCancel.status).toBe(409);
  });

  it('rejects cancelling someone else’s leave request', async () => {
    const { employee } = await makeLinkedEmployeeUser();
    const { accessToken: otherToken } = await makeLinkedEmployeeUser();
    const leave = await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'vacation',
      startDate: new Date('2030-05-20'),
      endDate: new Date('2030-05-21'),
      totalDays: 2,
      status: 'pending',
    });

    const res = await request(app).post(`/api/v1/leave/${leave.id}/cancel`).set(authHeader(otherToken));
    expect(res.status).toBe(403);
  });

  it('requires department-approval before hr-approval can happen', async () => {
    const { employee } = await makeLinkedEmployeeUser();
    const { accessToken: hrToken } = await createUserWithRole('hr_manager');
    const leave = await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'vacation',
      startDate: new Date('2030-06-01'),
      endDate: new Date('2030-06-02'),
      totalDays: 2,
      status: 'pending',
    });

    const skipAhead = await request(app)
      .post(`/api/v1/leave/${leave.id}/hr-approve`)
      .set(authHeader(hrToken))
      .send({});
    expect(skipAhead.status).toBe(409);
  });

  it('full workflow: submit -> department-approve -> hr-approve auto-declines the overlapping shift assignment', async () => {
    const department = await makeDepartment();
    const { employee, accessToken: employeeToken } = await makeLinkedEmployeeUser({ department: department.id } as never);
    const { accessToken: deptHeadToken } = await createUserWithRole('department_head');
    const { accessToken: hrToken } = await createUserWithRole('hr_manager');

    const schedule = await makeSchedule({ department: department.id });
    const shift = await makeShift({
      schedule: schedule.id,
      department: department.id,
      date: new Date('2030-07-10'),
    });
    await ShiftAssignment.create({ shift: shift.id, employee: employee.id, status: 'assigned' });

    const submitted = await request(app)
      .post('/api/v1/leave')
      .set(authHeader(employeeToken))
      .send({ leaveType: 'sick', startDate: '2030-07-10', endDate: '2030-07-10' });
    const leaveId = submitted.body.data.id;

    const deptApprove = await request(app)
      .post(`/api/v1/leave/${leaveId}/department-approve`)
      .set(authHeader(deptHeadToken))
      .send({ comment: 'ok' });
    expect(deptApprove.status).toBe(200);
    expect(deptApprove.body.data.status).toBe('department_approved');

    const hrApprove = await request(app)
      .post(`/api/v1/leave/${leaveId}/hr-approve`)
      .set(authHeader(hrToken))
      .send({});
    expect(hrApprove.status).toBe(200);
    expect(hrApprove.body.data.status).toBe('approved');

    const assignment = await ShiftAssignment.findOne({ shift: shift.id, employee: employee.id });
    expect(assignment!.status).toBe('declined');
    expect(assignment!.notes).toMatch(/leave/i);
  });

  it('rejects a leave request with a reason', async () => {
    const { employee } = await makeLinkedEmployeeUser();
    const { accessToken: hrToken } = await createUserWithRole('hr_manager');
    const leave = await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'vacation',
      startDate: new Date('2030-08-01'),
      endDate: new Date('2030-08-02'),
      totalDays: 2,
      status: 'pending',
    });

    const res = await request(app)
      .post(`/api/v1/leave/${leave.id}/reject`)
      .set(authHeader(hrToken))
      .send({ rejectionReason: 'Insufficient coverage' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.rejectionReason).toBe('Insufficient coverage');
  });

  it('denies department/hr approval actions without leave:approve permission', async () => {
    const { employee } = await makeLinkedEmployeeUser();
    const { accessToken } = await makeLinkedEmployeeUser();
    const leave = await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'vacation',
      startDate: new Date('2030-09-01'),
      endDate: new Date('2030-09-02'),
      totalDays: 2,
      status: 'pending',
    });

    const res = await request(app)
      .post(`/api/v1/leave/${leave.id}/department-approve`)
      .set(authHeader(accessToken))
      .send({});
    expect(res.status).toBe(403);
  });
});
