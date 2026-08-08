import { Schedule, ISchedule } from '@models/Schedule.model';
import { ShiftAssignment } from '@models/ShiftAssignment.model';
import { ApiError } from '@utils/ApiError';
import { logger } from '@utils/logger';
import { buildGenerationPayload } from './constraintBuilder';
import { requestScheduleGeneration } from './schedulingClient';
import { GenerateScheduleResponse } from './types';

export async function generateSchedule(scheduleId: string): Promise<{ schedule: ISchedule; result: GenerateScheduleResponse }> {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw ApiError.notFound('Schedule not found');
  if (!['draft', 'generated'].includes(schedule.status)) {
    throw ApiError.conflict(`Cannot generate a schedule in "${schedule.status}" status`);
  }

  const payload = await buildGenerationPayload(scheduleId);

  if (payload.shifts.length === 0) {
    throw ApiError.badRequest(
      'No shifts to generate. Configure staffing requirements on the department or create shifts manually first.'
    );
  }
  if (payload.employees.length === 0) {
    throw ApiError.badRequest('No active employees are assigned to this department.');
  }

  schedule.status = 'generating';
  await schedule.save();

  let result: GenerateScheduleResponse;
  try {
    result = await requestScheduleGeneration(payload);
  } catch (error) {
    schedule.status = 'draft';
    await schedule.save();
    throw error;
  }

  const shiftIds = payload.shifts.map((s) => s.shiftId);
  await ShiftAssignment.deleteMany({ shift: { $in: shiftIds }, isAiGenerated: true });

  if (result.assignments.length > 0) {
    try {
      await ShiftAssignment.insertMany(
        result.assignments.map((a) => ({
          shift: a.shiftId,
          employee: a.employeeId,
          status: 'assigned',
          isAiGenerated: true,
        })),
        { ordered: false }
      );
    } catch (error) {
      // Duplicate-key entries mean a manual assignment already matches what the
      // solver chose — harmless. Anything else should surface.
      const isDuplicateKeyOnly =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000;
      if (!isDuplicateKeyOnly) {
        logger.error('Failed to persist some AI-generated shift assignments', error);
      }
    }
  }

  schedule.status = 'generated';
  schedule.constraintsSnapshot = payload.options as unknown as Record<string, unknown>;
  schedule.stats = result.stats as unknown as Record<string, unknown>;
  await schedule.save();

  return { schedule, result };
}
