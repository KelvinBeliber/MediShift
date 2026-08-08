import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader, makeLinkedEmployeeUser } from './helpers/auth';
import { makeDepartment } from './helpers/factories';

describe('Messages API', () => {
  it('sends a direct message and it appears in both participants’ conversation history', async () => {
    const { user: userA, accessToken: tokenA } = await makeLinkedEmployeeUser();
    const { user: userB, accessToken: tokenB } = await makeLinkedEmployeeUser();

    const sent = await request(app)
      .post('/api/v1/messages')
      .set(authHeader(tokenA))
      .send({ conversationType: 'direct', recipient: userB.id, content: 'Hey, can you cover my shift?' });
    expect(sent.status).toBe(201);

    const fromA = await request(app).get(`/api/v1/messages/direct/${userB.id}`).set(authHeader(tokenA));
    expect(fromA.body.data).toHaveLength(1);
    expect(fromA.body.data[0].content).toBe('Hey, can you cover my shift?');

    const fromB = await request(app).get(`/api/v1/messages/direct/${userA.id}`).set(authHeader(tokenB));
    expect(fromB.body.data).toHaveLength(1);
  });

  it('validates that direct messages require a recipient', async () => {
    const { accessToken } = await makeLinkedEmployeeUser();
    const res = await request(app)
      .post('/api/v1/messages')
      .set(authHeader(accessToken))
      .send({ conversationType: 'direct', content: 'no recipient' });
    expect(res.status).toBe(422);
  });

  it('sends a department group message visible to anyone viewing that department’s chat', async () => {
    const department = await makeDepartment();
    const { accessToken } = await makeLinkedEmployeeUser({ department: department.id } as never);

    const sent = await request(app)
      .post('/api/v1/messages')
      .set(authHeader(accessToken))
      .send({ conversationType: 'department', department: department.id, content: 'Team huddle at 3pm' });
    expect(sent.status).toBe(201);

    const history = await request(app)
      .get(`/api/v1/messages/department/${department.id}`)
      .set(authHeader(accessToken));
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].content).toBe('Team huddle at 3pm');
  });

  it('validates that department messages require a department', async () => {
    const { accessToken } = await makeLinkedEmployeeUser();
    const res = await request(app)
      .post('/api/v1/messages')
      .set(authHeader(accessToken))
      .send({ conversationType: 'department', content: 'no department' });
    expect(res.status).toBe(422);
  });

  it('marks a message as read', async () => {
    const { user: userA, accessToken: tokenA } = await makeLinkedEmployeeUser();
    const { user: userB, accessToken: tokenB } = await makeLinkedEmployeeUser();

    const sent = await request(app)
      .post('/api/v1/messages')
      .set(authHeader(tokenA))
      .send({ conversationType: 'direct', recipient: userB.id, content: 'hi' });

    const markRead = await request(app)
      .put(`/api/v1/messages/${sent.body.data.id}/read`)
      .set(authHeader(tokenB));
    expect(markRead.status).toBe(200);
    expect(markRead.body.data.readBy.some((r: { user: string }) => r.user === userB.id)).toBe(true);

    void userA;
  });

  it('denies sending a message without message:send permission', async () => {
    const { accessToken: hrToken } = await createUserWithRole('hr_manager'); // no message:send by default
    const { user: recipient } = await makeLinkedEmployeeUser();

    const res = await request(app)
      .post('/api/v1/messages')
      .set(authHeader(hrToken))
      .send({ conversationType: 'direct', recipient: recipient.id, content: 'x' });
    expect(res.status).toBe(403);
  });
});
