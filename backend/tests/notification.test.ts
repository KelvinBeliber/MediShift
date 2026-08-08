import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader, makeLinkedEmployeeUser } from './helpers/auth';
import { LeaveRequest } from '../src/models/LeaveRequest.model';

describe('Notifications API', () => {
  it('is scoped to the logged-in user only', async () => {
    const { employee, user: userA, accessToken: tokenA } = await makeLinkedEmployeeUser();
    const { accessToken: tokenB } = await makeLinkedEmployeeUser();

    // Trigger a real notification via the leave-approval flow (HR-approve
    // notifies the employee) rather than inserting one directly, so this also
    // exercises the actual notification-creation code path.
    const { accessToken: hrToken } = await createUserWithRole('hr_manager');
    const leave = await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'vacation',
      startDate: new Date('2030-01-01'),
      endDate: new Date('2030-01-02'),
      totalDays: 2,
      status: 'department_approved',
    });
    await request(app).post(`/api/v1/leave/${leave.id}/hr-approve`).set(authHeader(hrToken)).send({});

    const ownList = await request(app).get('/api/v1/notifications').set(authHeader(tokenA));
    expect(ownList.body.data.notifications.length).toBeGreaterThanOrEqual(1);
    expect(ownList.body.data.notifications[0].type).toBe('leave_approved');
    expect(ownList.body.data.unreadCount).toBeGreaterThanOrEqual(1);

    const othersList = await request(app).get('/api/v1/notifications').set(authHeader(tokenB));
    expect(othersList.body.data.notifications).toHaveLength(0);

    void userA; // referenced for clarity of ownership; not asserted directly
  });

  it('marks a single notification as read', async () => {
    const { employee, accessToken } = await makeLinkedEmployeeUser();
    const { accessToken: hrToken } = await createUserWithRole('hr_manager');
    const leave = await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'sick',
      startDate: new Date('2030-02-01'),
      endDate: new Date('2030-02-01'),
      totalDays: 1,
      status: 'pending',
    });
    await request(app).post(`/api/v1/leave/${leave.id}/reject`).set(authHeader(hrToken)).send({ rejectionReason: 'x' });

    const list = await request(app).get('/api/v1/notifications').set(authHeader(accessToken));
    const notificationId = list.body.data.notifications[0].id;

    const markRead = await request(app).put(`/api/v1/notifications/${notificationId}/read`).set(authHeader(accessToken));
    expect(markRead.status).toBe(200);
    expect(markRead.body.data.isRead).toBe(true);

    const unreadOnly = await request(app).get('/api/v1/notifications?isRead=false').set(authHeader(accessToken));
    expect(unreadOnly.body.data.notifications.find((n: { id: string }) => n.id === notificationId)).toBeUndefined();
  });

  it('marks all notifications as read at once', async () => {
    const { employee, accessToken } = await makeLinkedEmployeeUser();
    const { accessToken: hrToken } = await createUserWithRole('hr_manager');

    for (let i = 0; i < 3; i++) {
      const leave = await LeaveRequest.create({
        employee: employee.id,
        leaveType: 'sick',
        startDate: new Date(`2030-03-0${i + 1}`),
        endDate: new Date(`2030-03-0${i + 1}`),
        totalDays: 1,
        status: 'pending',
      });
      await request(app).post(`/api/v1/leave/${leave.id}/reject`).set(authHeader(hrToken)).send({ rejectionReason: 'x' });
    }

    const markAll = await request(app).put('/api/v1/notifications/read-all').set(authHeader(accessToken));
    expect(markAll.status).toBe(200);
    expect(markAll.body.data.modifiedCount).toBeGreaterThanOrEqual(3);

    const remaining = await request(app).get('/api/v1/notifications?isRead=false').set(authHeader(accessToken));
    expect(remaining.body.data.notifications).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });
});
