export const EMPLOYMENT_TYPE = ['full_time', 'part_time', 'contract', 'per_diem', 'intern'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPE)[number];

export const EMPLOYEE_STATUS = ['active', 'inactive', 'on_leave', 'terminated'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUS)[number];

export const SHIFT_TYPE = [
  'morning',
  'afternoon',
  'night',
  'weekend',
  'holiday',
  'on_call',
  'overtime',
  'half_day',
] as const;
export type ShiftType = (typeof SHIFT_TYPE)[number];

export const SHIFT_ASSIGNMENT_STATUS = ['assigned', 'confirmed', 'declined', 'completed', 'no_show'] as const;
export type ShiftAssignmentStatus = (typeof SHIFT_ASSIGNMENT_STATUS)[number];

export const SCHEDULE_STATUS = ['draft', 'generating', 'generated', 'published', 'archived'] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUS)[number];

export const ATTENDANCE_STATUS = ['present', 'late', 'absent', 'leave', 'holiday', 'overtime'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];

export const LEAVE_TYPE = [
  'vacation',
  'sick',
  'emergency',
  'maternity',
  'paternity',
  'bereavement',
  'study',
] as const;
export type LeaveType = (typeof LEAVE_TYPE)[number];

export const LEAVE_STATUS = ['pending', 'department_approved', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUS)[number];

export const SHIFT_SWAP_STATUS = [
  'pending',
  'accepted',
  'manager_approved',
  'rejected',
  'cancelled',
] as const;
export type ShiftSwapStatus = (typeof SHIFT_SWAP_STATUS)[number];

export const ANNOUNCEMENT_PRIORITY = ['normal', 'important', 'emergency'] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITY)[number];

export const ANNOUNCEMENT_SCOPE = ['hospital', 'department'] as const;
export type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPE)[number];

export const NOTIFICATION_TYPE = [
  'schedule_published',
  'schedule_changed',
  'leave_approved',
  'leave_rejected',
  'shift_swap_approved',
  'shift_swap_requested',
  'announcement',
  'shift_reminder',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[number];

export const NOTIFICATION_CHANNEL = ['in_app', 'email', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[number];

export const DOCUMENT_TYPE = [
  'resume',
  'contract',
  'government_id',
  'medical_license',
  'certification',
  'training_certificate',
  'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPE)[number];

export const PAYROLL_STATUS = ['draft', 'finalized', 'exported'] as const;
export type PayrollStatus = (typeof PAYROLL_STATUS)[number];
