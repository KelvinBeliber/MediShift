import { Types } from 'mongoose';
import { Shift } from '@models/Shift.model';
import { ShiftAssignment, IShiftAssignment } from '@models/ShiftAssignment.model';
import { Employee } from '@models/Employee.model';
import { ApiError } from '@utils/ApiError';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  let aS = toMinutes(aStart);
  let aE = toMinutes(aEnd);
  let bS = toMinutes(bStart);
  let bE = toMinutes(bEnd);
  if (aE <= aS) aE += 24 * 60; // overnight shift
  if (bE <= bS) bE += 24 * 60;
  return aS < bE && bS < aE;
}

export async function assertNoDoubleBooking(
  employeeId: string,
  shift: { date: Date; startTime: string; endTime: string },
  excludeShiftId?: string
) {
  const sameDayAssignments = await ShiftAssignment.find({
    employee: employeeId,
    status: { $in: ['assigned', 'confirmed'] },
    ...(excludeShiftId ? { shift: { $ne: excludeShiftId } } : {}),
  }).populate<{ shift: { date: Date; startTime: string; endTime: string } }>('shift', 'date startTime endTime');

  const conflict = sameDayAssignments.find((assignment) => {
    const otherShift = assignment.shift as unknown as { date: Date; startTime: string; endTime: string };
    if (!otherShift?.date) return false;
    const sameDay = new Date(otherShift.date).toDateString() === new Date(shift.date).toDateString();
    if (!sameDay) return false;
    return timeRangesOverlap(shift.startTime, shift.endTime, otherShift.startTime, otherShift.endTime);
  });

  if (conflict) {
    throw ApiError.conflict('Employee is already assigned to an overlapping shift on this date');
  }
}

export async function assignEmployee(
  shiftId: string,
  employeeId: string,
  assignedByUserId: string,
  notes?: string
): Promise<IShiftAssignment> {
  // Deliberately not populated: requiredCertifications must stay raw ObjectIds
  // so the .toString() comparison below works (a populated doc's .toString()
  // is "[object Object]", not its hex id, which would silently break this check).
  const shift = await Shift.findById(shiftId);
  if (!shift) throw ApiError.notFound('Shift not found');

  const employee = await Employee.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');
  if (employee.status !== 'active') {
    throw ApiError.badRequest('Only active employees can be assigned to shifts');
  }

  if (shift.requiredCertifications.length > 0) {
    const employeeCertIds = new Set(
      employee.certifications
        .filter((c) => !c.expiryDate || c.expiryDate > new Date())
        .map((c) => c.certification.toString())
    );
    const missing = shift.requiredCertifications.filter((certId) => !employeeCertIds.has(certId.toString()));
    if (missing.length > 0) {
      throw ApiError.badRequest('Employee does not hold the certification(s) required for this shift');
    }
  }

  const currentCount = await ShiftAssignment.countDocuments({
    shift: shiftId,
    status: { $in: ['assigned', 'confirmed'] },
  });
  if (currentCount >= shift.requiredStaff) {
    throw ApiError.conflict('This shift is already fully staffed');
  }

  await assertNoDoubleBooking(employeeId, shift);

  try {
    return await ShiftAssignment.create({
      shift: shift._id as Types.ObjectId,
      employee: employee._id as Types.ObjectId,
      assignedBy: assignedByUserId,
      isAiGenerated: false,
      notes,
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000) {
      throw ApiError.conflict('Employee is already assigned to this shift');
    }
    throw error;
  }
}

export async function updateAssignmentStatus(
  assignmentId: string,
  status: IShiftAssignment['status'],
  notes?: string
): Promise<IShiftAssignment> {
  const assignment = await ShiftAssignment.findById(assignmentId);
  if (!assignment) throw ApiError.notFound('Shift assignment not found');

  assignment.status = status;
  if (status === 'confirmed') assignment.confirmedAt = new Date();
  if (notes !== undefined) assignment.notes = notes;
  await assignment.save();
  return assignment;
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  const assignment = await ShiftAssignment.findById(assignmentId);
  if (!assignment) throw ApiError.notFound('Shift assignment not found');
  await assignment.deleteOne();
}
