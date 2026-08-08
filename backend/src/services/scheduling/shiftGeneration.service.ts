import { Schedule, ISchedule } from '@models/Schedule.model';
import { Shift, IShift } from '@models/Shift.model';
import { Department, IDepartment } from '@models/Department.model';
import { ApiError } from '@utils/ApiError';
import { ShiftType } from '@constants/enums';

// Per-shiftType default clock times used when auto-expanding a department's
// staffing requirements into concrete Shift documents.
export const SHIFT_TIME_DEFAULTS: Partial<Record<ShiftType, { startTime: string; endTime: string }>> = {
  morning: { startTime: '07:00', endTime: '15:00' },
  afternoon: { startTime: '15:00', endTime: '23:00' },
  night: { startTime: '23:00', endTime: '07:00' },
  weekend: { startTime: '07:00', endTime: '15:00' },
};

// Staffing-requirement shift types that recur on a predictable daily/weekly cadence
// and can be auto-expanded into shift slots. Types like `holiday`, `on_call`,
// `overtime`, and `half_day` don't follow a fixed calendar pattern in this model
// (no holiday calendar yet) — managers add those shifts manually via the Shift API.
export const AUTO_GENERATABLE_TYPES = new Set<ShiftType>(['morning', 'afternoon', 'night', 'weekend']);

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function expandDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export interface ProposedShift {
  date: Date;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  requiredStaff: number;
  requiredCertifications: string[];
}

export interface ShiftGenerationWarning {
  shiftType: ShiftType;
  minStaff: number;
  reason: string;
}

interface ShiftGenerationPlan {
  schedule: ISchedule;
  department: IDepartment;
  existingCount: number;
  hasStaffingRequirements: boolean;
  proposed: ProposedShift[];
  warnings: ShiftGenerationWarning[];
}

async function computeShiftGenerationPlan(scheduleId: string): Promise<ShiftGenerationPlan> {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw ApiError.notFound('Schedule not found');

  const department = await Department.findById(schedule.department);
  if (!department) throw ApiError.badRequest('Department not found');

  const existing = await Shift.find({ schedule: scheduleId }, 'date shiftType');
  const existingKeys = new Set(existing.map((s) => `${toISODate(s.date)}_${s.shiftType}`));

  const proposed: ProposedShift[] = [];
  const warnings: ShiftGenerationWarning[] = [];
  const warnedTypes = new Set<ShiftType>();

  for (const requirement of department.staffingRequirements) {
    if (requirement.minStaff <= 0) continue;
    if (!AUTO_GENERATABLE_TYPES.has(requirement.shiftType) && !warnedTypes.has(requirement.shiftType)) {
      warnedTypes.add(requirement.shiftType);
      warnings.push({
        shiftType: requirement.shiftType,
        minStaff: requirement.minStaff,
        reason: `"${requirement.shiftType.replace('_', ' ')}" needs ${requirement.minStaff} staff per the department's staffing requirements, but this shift type doesn't follow a predictable daily pattern — create these shifts manually.`,
      });
    }
  }

  if (department.staffingRequirements.length > 0) {
    const dates = expandDateRange(schedule.startDate, schedule.endDate);

    for (const date of dates) {
      const isWeekendDay = [0, 6].includes(date.getUTCDay());

      for (const requirement of department.staffingRequirements) {
        if (requirement.minStaff <= 0) continue;
        if (!AUTO_GENERATABLE_TYPES.has(requirement.shiftType)) continue;
        if (requirement.shiftType === 'weekend' && !isWeekendDay) continue;
        if (requirement.shiftType !== 'weekend' && isWeekendDay) continue;

        const times = SHIFT_TIME_DEFAULTS[requirement.shiftType];
        if (!times) continue;

        const key = `${toISODate(date)}_${requirement.shiftType}`;
        if (existingKeys.has(key)) continue;

        proposed.push({
          date,
          shiftType: requirement.shiftType,
          startTime: times.startTime,
          endTime: times.endTime,
          requiredStaff: requirement.minStaff,
          requiredCertifications: requirement.requiredCertifications.map((c) => c.toString()),
        });
      }
    }
  }

  return {
    schedule,
    department,
    existingCount: existing.length,
    hasStaffingRequirements: department.staffingRequirements.length > 0,
    proposed,
    warnings,
  };
}

export interface ShiftGenerationSummary {
  scheduleId: string;
  existingShiftCount: number;
  hasStaffingRequirements: boolean;
  proposedShiftCount: number;
  proposedByType: { shiftType: ShiftType; count: number; totalStaffSlots: number }[];
  totalStaffSlots: number;
  dateRange: { startDate: string; endDate: string };
  warnings: ShiftGenerationWarning[];
}

function summarize(plan: ShiftGenerationPlan): ShiftGenerationSummary {
  const byType = new Map<ShiftType, { count: number; totalStaffSlots: number }>();
  let totalStaffSlots = 0;
  for (const p of plan.proposed) {
    const entry = byType.get(p.shiftType) ?? { count: 0, totalStaffSlots: 0 };
    entry.count += 1;
    entry.totalStaffSlots += p.requiredStaff;
    byType.set(p.shiftType, entry);
    totalStaffSlots += p.requiredStaff;
  }

  return {
    scheduleId: plan.schedule.id,
    existingShiftCount: plan.existingCount,
    hasStaffingRequirements: plan.hasStaffingRequirements,
    proposedShiftCount: plan.proposed.length,
    proposedByType: Array.from(byType.entries()).map(([shiftType, v]) => ({ shiftType, ...v })),
    totalStaffSlots,
    dateRange: { startDate: toISODate(plan.schedule.startDate), endDate: toISODate(plan.schedule.endDate) },
    warnings: plan.warnings,
  };
}

/** Read-only: what would generating shifts for this schedule create right now. */
export async function previewShiftGeneration(scheduleId: string): Promise<ShiftGenerationSummary> {
  const plan = await computeShiftGenerationPlan(scheduleId);
  return summarize(plan);
}

/**
 * Creates only the shift slots that don't already exist (matched by date + shiftType),
 * so it's safe to call repeatedly — e.g. after widening a schedule's date range or
 * adding a new staffing requirement — without duplicating or touching existing shifts
 * (and the assignments on them).
 */
export async function generateShiftSlots(
  scheduleId: string
): Promise<{ created: IShift[]; summary: ShiftGenerationSummary }> {
  const plan = await computeShiftGenerationPlan(scheduleId);
  if (!['draft', 'generated'].includes(plan.schedule.status)) {
    throw ApiError.conflict(`Cannot generate shifts for a schedule in "${plan.schedule.status}" status`);
  }

  const summary = summarize(plan);
  if (plan.proposed.length === 0) return { created: [], summary };

  const docs = plan.proposed.map((p) => ({
    schedule: plan.schedule._id,
    department: plan.department._id,
    date: p.date,
    shiftType: p.shiftType,
    startTime: p.startTime,
    endTime: p.endTime,
    requiredStaff: p.requiredStaff,
    requiredCertifications: p.requiredCertifications,
  }));

  const created = (await Shift.insertMany(docs)) as unknown as IShift[];
  return { created, summary };
}

/** Used by the solver payload builder — fills any missing auto-generatable slots, then returns the full shift list. */
export async function ensureShiftSlots(scheduleId: string): Promise<IShift[]> {
  const plan = await computeShiftGenerationPlan(scheduleId);
  if (plan.proposed.length > 0) {
    const docs = plan.proposed.map((p) => ({
      schedule: plan.schedule._id,
      department: plan.department._id,
      date: p.date,
      shiftType: p.shiftType,
      startTime: p.startTime,
      endTime: p.endTime,
      requiredStaff: p.requiredStaff,
      requiredCertifications: p.requiredCertifications,
    }));
    await Shift.insertMany(docs);
  }
  return Shift.find({ schedule: scheduleId });
}
