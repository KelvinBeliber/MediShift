import { EmploymentType } from './enums';

export const DEFAULT_MAX_HOURS_PER_WEEK: Record<EmploymentType, number> = {
  full_time: 40,
  part_time: 24,
  contract: 40,
  per_diem: 40,
  intern: 32,
};

export const DEFAULT_MAX_CONSECUTIVE_DAYS = 5;
export const DEFAULT_MIN_REST_HOURS = 10;
export const WEEKS_PER_MONTH = 4.345;
export const DEFAULT_SOLVER_TIME_SECONDS = 30;
