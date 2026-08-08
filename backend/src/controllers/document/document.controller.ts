import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import { PERMISSIONS } from '@constants/permissions';
import * as documentService from '@services/document/document.service';
import { recordAudit } from '@services/audit/audit.service';

function assertSelfOrPermission(req: Request, targetEmployeeId: string, permission: string, verb: string): void {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const isSelf = req.user.employeeId === targetEmployeeId;
  if (!isSelf && !req.user.permissions.includes(permission)) {
    throw ApiError.forbidden(`You can only ${verb} your own documents`);
  }
}

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = paramId(req.params.id);
  assertSelfOrPermission(req, employeeId, PERMISSIONS.EMPLOYEE_EDIT, 'upload');

  if (!req.file) {
    throw ApiError.badRequest('No file was uploaded (expected multipart field "file")');
  }

  const document = await documentService.uploadDocument(employeeId, req.body.type, req.file, req.user!.id);
  recordAudit({
    userId: req.user!.id,
    action: 'CREATE',
    entityType: 'Document',
    entityId: document.id,
    after: { fileName: document.fileName, type: document.type, owner: employeeId },
    req,
  });
  sendSuccess(res, 201, 'Document uploaded', document);
});

export const getDocuments = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = paramId(req.params.id);
  assertSelfOrPermission(req, employeeId, PERMISSIONS.EMPLOYEE_VIEW, 'view');

  const documents = await documentService.listDocuments(employeeId);
  sendSuccess(res, 200, 'Documents retrieved', documents);
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await documentService.getDocument(paramId(req.params.id));
  assertSelfOrPermission(req, document.owner.toString(), PERMISSIONS.EMPLOYEE_EDIT, 'delete');

  await documentService.deleteDocument(document.id);
  recordAudit({
    userId: req.user!.id,
    action: 'DELETE',
    entityType: 'Document',
    entityId: document.id,
    after: { fileName: document.fileName, type: document.type, owner: document.owner.toString() },
    req,
  });
  sendSuccess(res, 200, 'Document deleted');
});
