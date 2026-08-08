export interface ShiftInput {
  shiftId: string;
  date: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  requiredStaff: number;
  requiredCertifications: string[];
}

export interface EmployeeInput {
  employeeId: string;
  certifications: string[];
  maxHoursPerWeek: number;
  maxHoursPerMonth: number;
  maxConsecutiveDays: number;
  minRestHours: number;
  unavailableDates: string[];
  preferredShiftTypes: string[];
}

export interface SolverOptions {
  maxSolverTimeSeconds?: number;
  coverageWeight?: number;
  preferenceWeight?: number;
  fairnessWeight?: number;
}

export interface GenerateScheduleRequest {
  scheduleId: string;
  startDate: string;
  endDate: string;
  shifts: ShiftInput[];
  employees: EmployeeInput[];
  options?: SolverOptions;
}

export interface Assignment {
  shiftId: string;
  employeeId: string;
}

export interface UnfilledShift {
  shiftId: string;
  requiredStaff: number;
  assignedCount: number;
  shortBy: number;
}

export interface SolveStats {
  solveTimeSeconds: number;
  objectiveValue?: number;
  totalShifts: number;
  totalEmployees: number;
  totalAssignments: number;
  coveragePercent: number;
}

export interface GenerateScheduleResponse {
  status: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN' | 'MODEL_INVALID' | string;
  assignments: Assignment[];
  unfilledShifts: UnfilledShift[];
  stats?: SolveStats;
  message: string;
}
