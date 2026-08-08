import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import * as certificationService from '@services/certification/certification.service';

export const getCertifications = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationParams(req);
  const { docs, meta } = await certificationService.listCertifications(pagination);
  sendSuccess(res, 200, 'Certifications retrieved', docs, meta);
});

export const getCertification = asyncHandler(async (req: Request, res: Response) => {
  const certification = await certificationService.getCertification(paramId(req.params.id));
  sendSuccess(res, 200, 'Certification retrieved', certification);
});

export const createCertification = asyncHandler(async (req: Request, res: Response) => {
  const certification = await certificationService.createCertification(req.body);
  sendSuccess(res, 201, 'Certification created', certification);
});

export const updateCertification = asyncHandler(async (req: Request, res: Response) => {
  const certification = await certificationService.updateCertification(paramId(req.params.id), req.body);
  sendSuccess(res, 200, 'Certification updated', certification);
});

export const deactivateCertification = asyncHandler(async (req: Request, res: Response) => {
  const certification = await certificationService.deactivateCertification(paramId(req.params.id));
  sendSuccess(res, 200, 'Certification deactivated', certification);
});
