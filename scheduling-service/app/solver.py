import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from ortools.sat.python import cp_model

from .models import (
    Assignment,
    EmployeeInput,
    GenerateScheduleRequest,
    GenerateScheduleResponse,
    ShiftInput,
    SolveStats,
    UnfilledShift,
)

WEEKEND_DAYS = {5, 6}  # Saturday, Sunday


@dataclass
class ShiftTiming:
    shift: ShiftInput
    start_dt: datetime
    end_dt: datetime
    duration_minutes: int
    week_key: tuple[int, int]


def _parse_time(value: str) -> tuple[int, int]:
    hh, mm = value.split(":")
    return int(hh), int(mm)


def _shift_timing(shift: ShiftInput) -> ShiftTiming:
    sh, sm = _parse_time(shift.startTime)
    eh, em = _parse_time(shift.endTime)
    start_dt = datetime.combine(shift.date, datetime.min.time()).replace(hour=sh, minute=sm)
    end_dt = datetime.combine(shift.date, datetime.min.time()).replace(hour=eh, minute=em)
    if end_dt <= start_dt:
        end_dt += timedelta(days=1)  # overnight shift
    duration_minutes = int((end_dt - start_dt).total_seconds() // 60)
    iso = shift.date.isocalendar()
    return ShiftTiming(shift=shift, start_dt=start_dt, end_dt=end_dt, duration_minutes=duration_minutes, week_key=(iso[0], iso[1]))


def _has_conflict(a: ShiftTiming, b: ShiftTiming, rest_hours: float) -> bool:
    gap_ab = (b.start_dt - a.end_dt).total_seconds() / 3600
    gap_ba = (a.start_dt - b.end_dt).total_seconds() / 3600
    return max(gap_ab, gap_ba) < rest_hours


def _is_eligible(employee: EmployeeInput, shift: ShiftInput) -> bool:
    if shift.date in employee.unavailableDates:
        return False
    if shift.requiredCertifications:
        employee_certs = set(employee.certifications)
        if not set(shift.requiredCertifications).issubset(employee_certs):
            return False
    return True


def solve(request: GenerateScheduleRequest) -> GenerateScheduleResponse:
    start_time = time.time()

    shifts = request.shifts
    employees = request.employees
    opts = request.options

    if not shifts:
        return GenerateScheduleResponse(status="OPTIMAL", message="No shifts to schedule.", stats=SolveStats(
            solveTimeSeconds=0, totalShifts=0, totalEmployees=len(employees), totalAssignments=0, coveragePercent=100.0
        ))

    timings = [_shift_timing(s) for s in shifts]

    model = cp_model.CpModel()

    # x[(e_idx, s_idx)] only created for eligible (employee, shift) pairs.
    x: dict[tuple[int, int], cp_model.IntVar] = {}
    eligible_shifts_by_employee: dict[int, list[int]] = {i: [] for i in range(len(employees))}

    for e_idx, employee in enumerate(employees):
        for s_idx, shift in enumerate(shifts):
            if _is_eligible(employee, shift):
                x[(e_idx, s_idx)] = model.NewBoolVar(f"x_e{e_idx}_s{s_idx}")
                eligible_shifts_by_employee[e_idx].append(s_idx)

    # --- Coverage cap: never assign more than required for a shift ---
    for s_idx, shift in enumerate(shifts):
        vars_for_shift = [x[(e_idx, s_idx)] for e_idx in range(len(employees)) if (e_idx, s_idx) in x]
        if vars_for_shift:
            model.Add(sum(vars_for_shift) <= shift.requiredStaff)

    # --- No double-booking / minimum rest period between shifts ---
    for e_idx, employee in enumerate(employees):
        shift_indices = eligible_shifts_by_employee[e_idx]
        for a in range(len(shift_indices)):
            for b in range(a + 1, len(shift_indices)):
                i, j = shift_indices[a], shift_indices[b]
                if _has_conflict(timings[i], timings[j], employee.minRestHours):
                    model.Add(x[(e_idx, i)] + x[(e_idx, j)] <= 1)

    # --- Max hours per week ---
    for e_idx, employee in enumerate(employees):
        by_week: dict[tuple[int, int], list[int]] = {}
        for s_idx in eligible_shifts_by_employee[e_idx]:
            by_week.setdefault(timings[s_idx].week_key, []).append(s_idx)
        max_minutes_week = int(round(employee.maxHoursPerWeek * 60))
        for week_shifts in by_week.values():
            model.Add(
                sum(timings[s_idx].duration_minutes * x[(e_idx, s_idx)] for s_idx in week_shifts) <= max_minutes_week
            )

    # --- Max hours per month (whole scheduling period) ---
    for e_idx, employee in enumerate(employees):
        shift_indices = eligible_shifts_by_employee[e_idx]
        if shift_indices:
            max_minutes_month = int(round(employee.maxHoursPerMonth * 60))
            model.Add(
                sum(timings[s_idx].duration_minutes * x[(e_idx, s_idx)] for s_idx in shift_indices) <= max_minutes_month
            )

    # --- Max consecutive working days ---
    for e_idx, employee in enumerate(employees):
        shifts_by_day: dict[date, list[int]] = {}
        for s_idx in eligible_shifts_by_employee[e_idx]:
            shifts_by_day.setdefault(timings[s_idx].shift.date, []).append(s_idx)
        if not shifts_by_day:
            continue

        work_day: dict[date, cp_model.IntVar] = {}
        for day, day_shift_indices in shifts_by_day.items():
            wd = model.NewBoolVar(f"work_e{e_idx}_{day.isoformat()}")
            model.AddMaxEquality(wd, [x[(e_idx, s_idx)] for s_idx in day_shift_indices])
            work_day[day] = wd

        all_days = sorted(work_day.keys())
        window = employee.maxConsecutiveDays + 1
        for start in range(len(all_days)):
            window_days = [d for d in all_days if all_days[start] <= d < all_days[start] + timedelta(days=window)]
            if len(window_days) == window:
                model.Add(sum(work_day[d] for d in window_days) <= employee.maxConsecutiveDays)

    # --- Objective: maximize coverage + preference bonus - fairness penalty ---
    all_vars = list(x.values())
    coverage_term = sum(all_vars) * int(opts.coverageWeight)

    preference_term = 0
    for (e_idx, s_idx), var in x.items():
        if timings[s_idx].shift.shiftType in employees[e_idx].preferredShiftTypes:
            preference_term += var * int(opts.preferenceWeight)

    weekend_counts = []
    total_counts = []
    for e_idx in range(len(employees)):
        e_vars = [x[(e_idx, s_idx)] for s_idx in eligible_shifts_by_employee[e_idx]]
        if not e_vars:
            continue
        total_counts.append(sum(e_vars))
        weekend_vars = [
            x[(e_idx, s_idx)] for s_idx in eligible_shifts_by_employee[e_idx]
            if timings[s_idx].shift.date.weekday() in WEEKEND_DAYS
        ]
        if weekend_vars:
            weekend_counts.append(sum(weekend_vars))

    fairness_penalty = 0
    if total_counts:
        max_total = model.NewIntVar(0, len(shifts), "max_total_load")
        model.AddMaxEquality(max_total, total_counts)
        fairness_penalty += max_total * int(opts.fairnessWeight)
    if weekend_counts:
        max_weekend = model.NewIntVar(0, len(shifts), "max_weekend_load")
        model.AddMaxEquality(max_weekend, weekend_counts)
        fairness_penalty += max_weekend * int(opts.fairnessWeight)

    model.Maximize(coverage_term + preference_term - fairness_penalty)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = opts.maxSolverTimeSeconds
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)

    solve_time = time.time() - start_time
    status_name = solver.StatusName(status)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return GenerateScheduleResponse(
            status=status_name,
            message="Solver could not find a feasible schedule within the given constraints.",
            stats=SolveStats(
                solveTimeSeconds=solve_time,
                totalShifts=len(shifts),
                totalEmployees=len(employees),
                totalAssignments=0,
                coveragePercent=0.0,
            ),
        )

    assignments: list[Assignment] = []
    assigned_count_by_shift: dict[int, int] = {i: 0 for i in range(len(shifts))}

    for (e_idx, s_idx), var in x.items():
        if solver.Value(var) == 1:
            assignments.append(Assignment(shiftId=shifts[s_idx].shiftId, employeeId=employees[e_idx].employeeId))
            assigned_count_by_shift[s_idx] += 1

    unfilled: list[UnfilledShift] = []
    total_required = 0
    total_assigned = 0
    for s_idx, shift in enumerate(shifts):
        total_required += shift.requiredStaff
        total_assigned += assigned_count_by_shift[s_idx]
        if assigned_count_by_shift[s_idx] < shift.requiredStaff:
            unfilled.append(
                UnfilledShift(
                    shiftId=shift.shiftId,
                    requiredStaff=shift.requiredStaff,
                    assignedCount=assigned_count_by_shift[s_idx],
                    shortBy=shift.requiredStaff - assigned_count_by_shift[s_idx],
                )
            )

    coverage_percent = (total_assigned / total_required * 100) if total_required > 0 else 100.0

    return GenerateScheduleResponse(
        status=status_name,
        assignments=assignments,
        unfilledShifts=unfilled,
        stats=SolveStats(
            solveTimeSeconds=solve_time,
            objectiveValue=solver.ObjectiveValue(),
            totalShifts=len(shifts),
            totalEmployees=len(employees),
            totalAssignments=len(assignments),
            coveragePercent=round(coverage_percent, 2),
        ),
        message=f"Solved with status {status_name}.",
    )
