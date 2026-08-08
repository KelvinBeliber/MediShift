import request from 'supertest';
import { app } from './helpers/app';

describe('GET /api/v1/health', () => {
  it('returns a healthy status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.database).toBe('connected');
  });
});
