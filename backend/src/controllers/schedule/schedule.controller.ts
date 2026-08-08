import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { getPaginationParams } from '@utils/pagination';
import { paramId } from '@utils/requestParams';
import { ApiError } from '@utils/ApiError';
import * as scheduleService from '@services/schedule/schedule.service';
import * as generationService from '@services/scheduling/generation.service';
import * as shiftGenerationService from '@services/scheduling/shiftGeneration.service';
import { recordAudit } from '@services/audit/audit.service';

export const getSchedules = asyncHandler(async (req: Request, res: Response) => {
  const pagination = getPaginationParams(req);
  const { department, month, year, status } = (req.validatedQuery ?? {}) as Record<string, string | undefined>;

  const { docs, meta } = await scheduleService.listSchedules(
    {
      department,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      status,
    },
    pagination
  );

  sendSuccess(res, 200, 'Schedules retrieved', docs, meta);
});

export const getSchedule = asyncHandler(async (req: Request, res: Response) => {
  const schedule = await scheduleService.getSchedule(paramId(req.params.id));
  sendSuccess(res, 200, 'Schedule retrieved', schedule);
});

export const createSchedule = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const schedule = await scheduleService.createSchedule({ ...req.body, generatedBy: req.user.id });
  sendSuccess(res, 201, 'Schedule created', schedule);
});

export const updateSchedule = asyncHandler(async (req: Request, res: Response) => {
  const schedule = await scheduleService.updateSchedule(paramId(req.params.id), req.body);
  sendSuccess(res, 200, 'Schedule updated', schedule);
});

export const deleteSchedule = asyncHandler(async (req: Request, res: Response) => {
  await scheduleService.deleteSchedule(paramId(req.params.id));
  sendSuccess(res, 200, 'Schedule deleted');
});

export const publishSchedule = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const schedule = await scheduleService.publishSchedule(paramId(req.params.id), req.user.id);
  recordAudit({ userId: req.user.id, action: 'PUBLISH', entityType: 'Schedule', entityId: schedule.id, after: schedule, req });
  sendSuccess(res, 200, 'Schedule published', schedule);
});

export const generateSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { schedule, result } = await generationService.generateSchedule(paramId(req.params.id));
  sendSuccess(res, 200, `Schedule generation ${result.status.toLowerCase()}`, { schedule, generation: result });
});

export const previewShiftGeneration = asyncHandler(async (req: Request, res: Response) => {
  const summary = await shiftGenerationService.previewShiftGeneration(paramId(req.params.id));
  sendSuccess(res, 200, 'Shift generation preview', summary);
});

export const generateShifts = asyncHandler(async (req: Request, res: Response) => {
  const { created, summary } = await shiftGenerationService.generateShiftSlots(paramId(req.params.id));
  const message =
    created.length > 0
      ? `${created.length} shift${created.length === 1 ? '' : 's'} created`
      : 'No new shifts to create — everything is already generated';
  sendSuccess(res, 200, message, { created, summary });
});
