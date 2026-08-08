from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class ShiftInput(BaseModel):
    shiftId: str
    date: date
    shiftType: str
    startTime: str  # "HH:MM", 24h
    endTime: str  # "HH:MM", 24h — may be earlier than startTime for overnight shifts
    requiredStaff: int = Field(ge=0)
    requiredCertifications: list[str] = Field(default_factory=list)


class EmployeeInput(BaseModel):
    employeeId: str
    certifications: list[str] = Field(default_factory=list)
    maxHoursPerWeek: float = 40.0
    maxHoursPerMonth: float = 173.0
    maxConsecutiveDays: int = 5
    minRestHours: float = 10.0
    unavailableDates: list[date] = Field(default_factory=list)
    preferredShiftTypes: list[str] = Field(default_factory=list)


class SolverOptions(BaseModel):
    maxSolverTimeSeconds: float = 30.0
    coverageWeight: float = 1000.0
    preferenceWeight: float = 5.0
    fairnessWeight: float = 10.0


class GenerateScheduleRequest(BaseModel):
    scheduleId: str
    startDate: date
    endDate: date
    shifts: list[ShiftInput]
    employees: list[EmployeeInput]
    options: SolverOptions = Field(default_factory=SolverOptions)


class Assignment(BaseModel):
    shiftId: str
    employeeId: str


class UnfilledShift(BaseModel):
    shiftId: str
    requiredStaff: int
    assignedCount: int
    shortBy: int


class SolveStats(BaseModel):
    solveTimeSeconds: float
    objectiveValue: Optional[float] = None
    totalShifts: int
    totalEmployees: int
    totalAssignments: int
    coveragePercent: float


class GenerateScheduleResponse(BaseModel):
    status: str  # OPTIMAL | FEASIBLE | INFEASIBLE | ERROR
    assignments: list[Assignment] = Field(default_factory=list)
    unfilledShifts: list[UnfilledShift] = Field(default_factory=list)
    stats: Optional[SolveStats] = None
    message: str = ""
