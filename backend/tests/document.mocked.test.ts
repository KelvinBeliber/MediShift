import { PassThrough } from 'stream';
import request from 'supertest';

const mockUploadStream = jest.fn((_options: unknown, callback: unknown) => {
  const stream = new PassThrough();
  stream.on('finish', () => {
    (callback as (err: unknown, result: unknown) => void)(null, {
      secure_url: 'https://res.cloudinary.test/medishift/fake.pdf',
      public_id: 'medishift/employees/fake-public-id',
    });
  });
  stream.resume();
  return stream;
});

const mockDestroy = jest.fn().mockResolvedValue({ result: 'ok' });

jest.mock('../src/config/cloudinary', () => ({
  isCloudinaryConfigured: true,
  cloudinary: {
    uploader: {
      upload_stream: mockUploadStream,
      destroy: mockDestroy,
    },
  },
}));

// Imports below must come after jest.mock (hoisted anyway, but kept in order for clarity).
import { app } from './helpers/app';
import { createUserWithRole, authHeader, makeLinkedEmployeeUser } from './helpers/auth';
import { makeEmployee } from './helpers/factories';
import { Document as DocumentModel } from '../src/models/Document.model';
import { Employee } from '../src/models/Employee.model';

describe('Documents API — with Cloudinary mocked as configured', () => {
  beforeEach(() => {
    mockUploadStream.mockClear();
    mockDestroy.mockClear();
  });

  function attachFile(req: request.Test) {
    return req.field('type', 'resume').attach('file', Buffer.from('%PDF-1.4 fake pdf content'), {
      filename: 'resume.pdf',
      contentType: 'application/pdf',
    });
  }

  it('uploads a document, creating a Document record and linking it to the employee', async () => {
    const { employee, accessToken } = await makeLinkedEmployeeUser();

    const res = await attachFile(
      request(app).post(`/api/v1/employees/${employee.id}/documents`).set(authHeader(accessToken))
    );

    expect(res.status).toBe(201);
    expect(res.body.data.url).toBe('https://res.cloudinary.test/medishift/fake.pdf');
    expect(res.body.data.type).toBe('resume');
    expect(mockUploadStream).toHaveBeenCalledTimes(1);

    const updatedEmployee = await Employee.findById(employee.id);
    expect(updatedEmployee!.documents.map((d) => d.toString())).toContain(res.body.data.id);
  });

  it('rejects upload without employee:edit unless it’s your own record', async () => {
    const targetEmployee = await makeEmployee();
    const { accessToken } = await makeLinkedEmployeeUser(); // a different employee, no employee:edit

    const res = await attachFile(
      request(app).post(`/api/v1/employees/${targetEmployee.id}/documents`).set(authHeader(accessToken))
    );

    expect(res.status).toBe(403);
    expect(mockUploadStream).not.toHaveBeenCalled();
  });

  it('allows HR (employee:edit) to upload documents on behalf of any employee', async () => {
    const targetEmployee = await makeEmployee();
    const { accessToken } = await createUserWithRole('hr_manager');

    const res = await attachFile(
      request(app).post(`/api/v1/employees/${targetEmployee.id}/documents`).set(authHeader(accessToken))
    );

    expect(res.status).toBe(201);
  });

  it('lists documents for an employee, visible to self', async () => {
    const { employee, accessToken } = await makeLinkedEmployeeUser();
    await attachFile(request(app).post(`/api/v1/employees/${employee.id}/documents`).set(authHeader(accessToken)));

    const res = await request(app).get(`/api/v1/employees/${employee.id}/documents`).set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('denies listing another employee’s documents without employee:view', async () => {
    const targetEmployee = await makeEmployee();
    const { accessToken } = await makeLinkedEmployeeUser();

    const res = await request(app).get(`/api/v1/employees/${targetEmployee.id}/documents`).set(authHeader(accessToken));
    expect(res.status).toBe(403);
  });

  it('deletes a document, removing it from Cloudinary, the Document collection, and the employee’s list', async () => {
    const { employee, accessToken } = await makeLinkedEmployeeUser();
    const uploaded = await attachFile(
      request(app).post(`/api/v1/employees/${employee.id}/documents`).set(authHeader(accessToken))
    );
    const documentId = uploaded.body.data.id;

    const del = await request(app).delete(`/api/v1/documents/${documentId}`).set(authHeader(accessToken));
    expect(del.status).toBe(200);
    expect(mockDestroy).toHaveBeenCalledWith('medishift/employees/fake-public-id');

    const stillExists = await DocumentModel.findById(documentId);
    expect(stillExists).toBeNull();

    const updatedEmployee = await Employee.findById(employee.id);
    expect(updatedEmployee!.documents).toHaveLength(0);
  });

  it('rejects deleting someone else’s document without employee:edit', async () => {
    const { employee: owner, accessToken: ownerToken } = await makeLinkedEmployeeUser();
    const uploaded = await attachFile(
      request(app).post(`/api/v1/employees/${owner.id}/documents`).set(authHeader(ownerToken))
    );

    const { accessToken: strangerToken } = await makeLinkedEmployeeUser();
    const res = await request(app).delete(`/api/v1/documents/${uploaded.body.data.id}`).set(authHeader(strangerToken));
    expect(res.status).toBe(403);
  });
});
