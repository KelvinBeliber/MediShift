from datetime import date

import pytest

from app.models import EmployeeInput, GenerateScheduleRequest, ShiftInput, SolverOptions
from app.solver import solve


def shift(
    shift_id,
    day,
    start="07:00",
    end="15:00",
    required_staff=1,
    shift_type="morning",
    certs=None,
):
    return ShiftInput(
        shiftId=shift_id,
        date=day,
        shiftType=shift_type,
        startTime=start,
        endTime=end,
        requiredStaff=required_staff,
        requiredCertifications=certs or [],
    )


def employee(
    employee_id,
    certs=None,
    max_hours_week=40.0,
    max_hours_month=173.0,
    max_consecutive_days=5,
    min_rest_hours=10.0,
    unavailable=None,
    preferred=None,
):
    return EmployeeInput(
        employeeId=employee_id,
        certifications=certs or [],
        maxHoursPerWeek=max_hours_week,
        maxHoursPerMonth=max_hours_month,
        maxConsecutiveDays=max_consecutive_days,
        minRestHours=min_rest_hours,
        unavailableDates=unavailable or [],
        preferredShiftTypes=preferred or [],
    )


def build_request(shifts, employees, **options):
    return GenerateScheduleRequest(
        scheduleId="test",
        startDate=date(2030, 1, 1),
        endDate=date(2030, 1, 31),
        shifts=shifts,
        employees=employees,
        options=SolverOptions(maxSolverTimeSeconds=10, **options),
    )


def assignments_for_shift(result, shift_id):
    return [a.employeeId for a in result.assignments if a.shiftId == shift_id]


class TestBasics:
    def test_no_shifts_returns_optimal_with_no_assignments(self):
        result = solve(build_request([], [employee("e1")]))
        assert result.status == "OPTIMAL"
        assert result.assignments == []

    def test_fills_a_simple_shift_with_the_only_eligible_employee(self):
        req = build_request([shift("s1", date(2030, 1, 7))], [employee("e1")])
        result = solve(req)
        assert result.status == "OPTIMAL"
        assert assignments_for_shift(result, "s1") == ["e1"]
        assert result.unfilledShifts == []


class TestCertificationEligibility:
    def test_only_the_certified_employee_is_assigned(self):
        req = build_request(
            [shift("icu_night", date(2030, 1, 7), shift_type="night", certs=["icu"])],
            [employee("certified", certs=["icu"]), employee("uncertified", certs=[])],
        )
        result = solve(req)
        assert assignments_for_shift(result, "icu_night") == ["certified"]

    def test_shift_goes_unfilled_when_nobody_holds_the_required_certification(self):
        req = build_request(
            [shift("icu_night", date(2030, 1, 7), shift_type="night", certs=["icu"])],
            [employee("nurse", certs=[])],
        )
        result = solve(req)
        assert assignments_for_shift(result, "icu_night") == []
        assert result.unfilledShifts[0].shiftId == "icu_night"
        assert result.unfilledShifts[0].shortBy == 1


class TestCoverageIsSoftNotHard:
    def test_max_consecutive_days_leaves_a_shift_unfilled_rather_than_violate_the_limit(self):
        # e1 is the only employee certified for ICU nights across 3 consecutive
        # days, but capped at 2 consecutive working days. The solver must drop
        # exactly one of the three shifts rather than violate the cap — but
        # since all three shifts are otherwise symmetric, WHICH one gets
        # dropped is an arbitrary tie-break, not a fixed outcome. Assert the
        # invariant (count), not the specific shift identity.
        shift_ids = ["night1", "night2", "night3"]
        req = build_request(
            [
                shift(sid, date(2030, 1, 1 + i), shift_type="night", certs=["icu"])
                for i, sid in enumerate(shift_ids)
            ],
            [employee("e1", certs=["icu"], max_consecutive_days=2)],
        )
        result = solve(req)

        total_assigned = sum(len(assignments_for_shift(result, sid)) for sid in shift_ids)
        assert total_assigned == 2, "exactly 2 of the 3 shifts should be filled, never all 3"
        assert len(result.unfilledShifts) == 1
        assert result.unfilledShifts[0].shiftId in shift_ids


class TestRestPeriodAndDoubleBooking:
    def test_forbids_two_shifts_with_insufficient_rest_between_them(self):
        # Same employee, same day, back to back with only a 2h gap (min rest 10h).
        req = build_request(
            [
                shift("s1", date(2030, 1, 7), start="07:00", end="15:00"),
                shift("s2", date(2030, 1, 7), start="17:00", end="23:00"),
            ],
            [employee("e1", min_rest_hours=10.0)],
        )
        result = solve(req)
        assert len(result.assignments) <= 1

    def test_allows_two_shifts_with_sufficient_rest_between_them(self):
        req = build_request(
            [
                shift("s1", date(2030, 1, 7), start="07:00", end="15:00"),
                shift("s2", date(2030, 1, 8), start="07:00", end="15:00"),
            ],
            [employee("e1", min_rest_hours=10.0)],
        )
        result = solve(req)
        assert len(result.assignments) == 2

    def test_forbids_true_time_overlap_on_the_same_day(self):
        req = build_request(
            [
                shift("s1", date(2030, 1, 7), start="07:00", end="15:00"),
                shift("s2", date(2030, 1, 7), start="12:00", end="20:00"),
            ],
            [employee("e1")],
        )
        result = solve(req)
        assert len(result.assignments) <= 1

    def test_overnight_shift_correctly_blocks_an_early_morning_conflict(self):
        req = build_request(
            [
                shift("night", date(2030, 1, 7), shift_type="night", start="20:00", end="08:00"),
                shift("early", date(2030, 1, 8), start="06:00", end="10:00"),
            ],
            [employee("e1", min_rest_hours=1.0)],
        )
        result = solve(req)
        # Night shift ends 08:00 on the 8th; "early" starts 06:00 on the 8th —
        # that's a genuine overlap regardless of rest hours.
        assert len(result.assignments) <= 1


class TestHourLimits:
    def test_respects_max_hours_per_week(self):
        # Two 8h shifts in the same ISO week; employee capped at 8h/week.
        req = build_request(
            [
                shift("s1", date(2030, 1, 7), start="07:00", end="15:00"),  # Monday
                shift("s2", date(2030, 1, 9), start="07:00", end="15:00"),  # Wednesday
            ],
            [employee("e1", max_hours_week=8.0)],
        )
        result = solve(req)
        assert len(result.assignments) <= 1

    def test_respects_max_hours_per_month(self):
        shifts = [
            shift(f"s{i}", date(2030, 1, 1 + i), start="07:00", end="15:00")
            for i in range(0, 20, 2)  # 10 shifts, spread across different weeks
        ]
        req = build_request(shifts, [employee("e1", max_hours_month=16.0, max_hours_week=999)])
        result = solve(req)
        # 16h cap / 8h shifts = at most 2 shifts all month.
        assert len(result.assignments) <= 2


class TestAvailability:
    def test_never_assigns_an_employee_on_an_unavailable_date(self):
        req = build_request(
            [shift("s1", date(2030, 1, 10))],
            [employee("e1", unavailable=[date(2030, 1, 10)])],
        )
        result = solve(req)
        assert assignments_for_shift(result, "s1") == []
        assert result.unfilledShifts[0].shiftId == "s1"


class TestFairnessAndPreferences:
    def test_balances_workload_evenly_across_interchangeable_employees(self):
        shifts = [shift(f"s{i}", date(2030, 1, 1 + i)) for i in range(4)]
        employees = [employee("e1"), employee("e2")]
        result = solve(build_request(shifts, employees))

        counts: dict[str, int] = {}
        for a in result.assignments:
            counts[a.employeeId] = counts.get(a.employeeId, 0) + 1

        assert sum(counts.values()) == 4
        assert counts.get("e1", 0) == 2
        assert counts.get("e2", 0) == 2

    def test_prefers_the_employee_who_favors_that_shift_type_when_otherwise_tied(self):
        req = build_request(
            [shift("night1", date(2030, 1, 7), shift_type="night")],
            [
                employee("prefers_night", preferred=["night"]),
                employee("no_preference", preferred=[]),
            ],
        )
        result = solve(req)
        assert assignments_for_shift(result, "night1") == ["prefers_night"]


if __name__ == "__main__":
    import sys

    sys.exit(pytest.main([__file__, "-v"]))
