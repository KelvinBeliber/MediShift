import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import * as payrollService from '@services/payroll/payroll.service';
import { recordAudit } from '@services/audit/audit.service';

export const generatePayroll = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const { periodStart, periodEnd, department } = req.body;
  const results = await payrollService.generatePayroll(new Date(periodStart), new Date(periodEnd), department, req.user.id);
  sendSuccess(res, 200, `Generated payroll input for ${results.length} employee(s)`, results);
});

export const getPayrollInputs = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationParams(req);
  const { employee, status, periodStart, periodEnd } = (req.validatedQuery ?? {}) as Record<string, string | undefined>;

  const { docs, meta } = await payrollService.listPayrollInputs(
    {
      employee,
      status,
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
    },
    pagination
  );
  sendSuccess(res, 200, 'Payroll inputs retrieved', docs, meta);
});

export const getPayrollInput = asyncHandler(async (req: Request, res: Response) => {
  const payroll = await payrollService.getPayrollInput(paramId(req.params.id));
  sendSuccess(res, 200, 'Payroll input retrieved', payroll);
});

export const finalizePayrollInput = asyncHandler(async (req: Request, res: Response) => {
  const payroll = await payrollService.finalizePayrollInput(paramId(req.params.id));
  recordAudit({ userId: req.user?.id, action: 'FINALIZE', entityType: 'PayrollInput', entityId: payroll.id, after: payroll, req });
  sendSuccess(res, 200, 'Payroll input finalized', payroll);
});

export const exportPayrollCsv = asyncHandler(async (req: Request, res: Response) => {
  const { periodStart, periodEnd } = (req.validatedQuery ?? {}) as Record<string, string>;
  const csv = await payrollService.exportPayrollCsv(new Date(periodStart), new Date(periodEnd));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="payroll_${periodStart}_${periodEnd}.csv"`);
  res.status(200).send(csv);
});
