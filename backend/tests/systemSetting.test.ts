import request from 'supertest';
import { app } from './helpers/app';
import { createUserWithRole, authHeader } from './helpers/auth';
import { SystemSetting } from '../src/models/SystemSetting.model';

describe('Settings API', () => {
  it('creates a setting via upsert (PUT) and retrieves it', async () => {
    const { accessToken } = await createUserWithRole('super_admin');

    const put = await request(app)
      .put('/api/v1/settings/hospital.name')
      .set(authHeader(accessToken))
      .send({ value: 'MediShift General Hospital', description: 'Displayed hospital name' });
    expect(put.status).toBe(200);
    expect(put.body.data.value).toBe('MediShift General Hospital');

    const get = await request(app).get('/api/v1/settings/hospital.name').set(authHeader(accessToken));
    expect(get.status).toBe(200);
    expect(get.body.data.value).toBe('MediShift General Hospital');
  });

  it('upsert overwrites an existing value rather than duplicating', async () => {
    const { accessToken } = await createUserWithRole('super_admin');
    await request(app).put('/api/v1/settings/max-upload-mb').set(authHeader(accessToken)).send({ value: 5 });
    await request(app).put('/api/v1/settings/max-upload-mb').set(authHeader(accessToken)).send({ value: 10 });

    const count = await SystemSetting.countDocuments({ key: 'max-upload-mb' });
    expect(count).toBe(1);

    const get = await request(app).get('/api/v1/settings/max-upload-mb').set(authHeader(accessToken));
    expect(get.body.data.value).toBe(10);
  });

  it('lists settings, excluding internal counter keys', async () => {
    const { accessToken } = await createUserWithRole('super_admin');
    await request(app).put('/api/v1/settings/visible-setting').set(authHeader(accessToken)).send({ value: 'x' });
    await SystemSetting.create({ key: 'counter:employee', value: 42 });

    const list = await request(app).get('/api/v1/settings').set(authHeader(accessToken));
    expect(list.status).toBe(200);
    const keys = list.body.data.map((s: { key: string }) => s.key);
    expect(keys).toContain('visible-setting');
    expect(keys).not.toContain('counter:employee');
  });

  it('blocks reading, writing, or deleting internal counter keys through the API', async () => {
    const { accessToken } = await createUserWithRole('super_admin');
    await SystemSetting.create({ key: 'counter:employee', value: 42 });

    const get = await request(app).get('/api/v1/settings/counter:employee').set(authHeader(accessToken));
    expect(get.status).toBe(403);

    const put = await request(app)
      .put('/api/v1/settings/counter:employee')
      .set(authHeader(accessToken))
      .send({ value: 999999 });
    expect(put.status).toBe(403);

    const del = await request(app).delete('/api/v1/settings/counter:employee').set(authHeader(accessToken));
    expect(del.status).toBe(403);
  });

  it('deletes a setting', async () => {
    const { accessToken } = await createUserWithRole('super_admin');
    await request(app).put('/api/v1/settings/temp-key').set(authHeader(accessToken)).send({ value: 'x' });

    const del = await request(app).delete('/api/v1/settings/temp-key').set(authHeader(accessToken));
    expect(del.status).toBe(200);

    const get = await request(app).get('/api/v1/settings/temp-key').set(authHeader(accessToken));
    expect(get.status).toBe(404);
  });

  it('is restricted to system_settings:manage — even hospital_admin is excluded by design', async () => {
    const { accessToken } = await createUserWithRole('hospital_admin');
    const res = await request(app).get('/api/v1/settings').set(authHeader(accessToken));
    expect(res.status).toBe(403);
  });
});
