/**
 * Human names for the assistant's tools.
 *
 * Past tense throughout: these are only ever rendered on a finished answer,
 * describing what was already read. They live here rather than beside the
 * loading component so that file exports a component and nothing else.
 *
 * Keys mirror `ASSISTANT_TOOLS` in `backend/src/services/assistant/tools.ts`.
 * An unmapped tool degrades to its own name rather than disappearing — a new
 * backend tool shows up as `get_something_new` in the trace, which is ugly but
 * honest, where hiding it would silently understate what the answer was read
 * from.
 */
const TOOL_LABELS: Record<string, string> = {
  list_departments: 'Looked up departments',
  get_overtime_summary: 'Read overtime records',
  get_staffing_levels: 'Checked staffing levels',
  get_attendance_summary: 'Read attendance records',
  get_upcoming_leave: 'Checked approved leave',
  get_expiring_certifications: 'Checked certification expiry',
  explain_shift_staffing: 'Worked out shift eligibility',
}

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool.replace(/_/g, ' ')
}
