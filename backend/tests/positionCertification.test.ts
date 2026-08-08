import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader } from './helpers/auth';
import { makeCertification, makePosition } from './helpers/factories';

describe('Positions API', () => {
  it('creates a position and rejects a duplicate title', async () => {
    const { accessToken } = await createUserWithRole('hr_manager');

    const created = await request(app)
      .post('/api/v1/positions')
      .set(authHeader(accessToken))
      .send({ title: 'Staff Nurse', defaultWorkingHoursPerWeek: 40 });
    expect(created.status).toBe(201);

    const dup = await request(app)
      .post('/api/v1/positions')
      .set(authHeader(accessToken))
      .send({ title: 'Staff Nurse' });
    expect(dup.status).toBe(409);
  });

  it('updates and deactivates a position', async () => {
    const position = await makePosition();
    const { accessToken } = await createUserWithRole('hr_manager');

    const updated = await request(app)
      .put(`/api/v1/positions/${position.id}`)
      .set(authHeader(accessToken))
      .send({ defaultWorkingHoursPerWeek: 32 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.defaultWorkingHoursPerWeek).toBe(32);

    const deactivated = await request(app).delete(`/api/v1/positions/${position.id}`).set(authHeader(accessToken));
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.isActive).toBe(false);
  });

  it('denies write access without position:manage permission', async () => {
    const { accessToken } = await createUserWithRole('employee');
    const res = await request(app).post('/api/v1/positions').set(authHeader(accessToken)).send({ title: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('Certifications API', () => {
  it('creates a certification and rejects a duplicate name or code', async () => {
    const { accessToken } = await createUserWithRole('hr_manager');

    const created = await request(app)
      .post('/api/v1/certifications')
      .set(authHeader(accessToken))
      .send({ name: 'ICU Certified', code: 'ICU' });
    expect(created.status).toBe(201);

    const dupName = await request(app)
      .post('/api/v1/certifications')
      .set(authHeader(accessToken))
      .send({ name: 'ICU Certified', code: 'ICU2' });
    expect(dupName.status).toBe(409);

    const dupCode = await request(app)
      .post('/api/v1/certifications')
      .set(authHeader(accessToken))
      .send({ name: 'ICU Certified 2', code: 'ICU' });
    expect(dupCode.status).toBe(409);
  });

  it('lists, updates, and deactivates certifications', async () => {
    const cert = await makeCertification();
    const { accessToken } = await createUserWithRole('hr_manager');

    const list = await request(app).get('/api/v1/certifications').set(authHeader(accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);

    const updated = await request(app)
      .put(`/api/v1/certifications/${cert.id}`)
      .set(authHeader(accessToken))
      .send({ issuingBody: 'AACN' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.issuingBody).toBe('AACN');

    const deactivated = await request(app)
      .delete(`/api/v1/certifications/${cert.id}`)
      .set(authHeader(accessToken));
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.isActive).toBe(false);
  });

  it('denies write access without certification:manage permission', async () => {
    const { accessToken } = await createUserWithRole('employee');
    const res = await request(app)
      .post('/api/v1/certifications')
      .set(authHeader(accessToken))
      .send({ name: 'X', code: 'X' });
    expect(res.status).toBe(403);
  });
});
