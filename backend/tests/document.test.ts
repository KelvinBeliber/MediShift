import request from 'supertest';
import { app } from './helpers/app';
import { makeLinkedEmployeeUser, authHeader } from './helpers/auth';

// This file deliberately does NOT mock @config/cloudinary — it exercises the
// real "not configured" code path, since the test .env genuinely has blank
// CLOUDINARY_* values. The mocked "configured" success path lives in
// document.mocked.test.ts, split out because jest.mock() hoists file-wide.
describe('Documents API — Cloudinary not configured (real test-env behavior)', () => {
  it('returns a clear error instead of crashing when file storage isn’t configured', async () => {
    const { employee, accessToken } = await makeLinkedEmployeeUser();

    const res = await request(app)
      .post(`/api/v1/employees/${employee.id}/documents`)
      .set(authHeader(accessToken))
      .field('type', 'resume')
      .attach('file', Buffer.from('%PDF-1.4 fake pdf content'), { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/not configured/i);
  });

  it('rejects an unsupported file type before ever reaching the storage-configured check', async () => {
    const { employee, accessToken } = await makeLinkedEmployeeUser();

    const res = await request(app)
      .post(`/api/v1/employees/${employee.id}/documents`)
      .set(authHeader(accessToken))
      .field('type', 'resume')
      .attach('file', Buffer.from('plain text'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });
});
