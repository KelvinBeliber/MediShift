# MediShift Frontend — 25 Screens to Build

This is a standalone build plan for the frontend. Written so a fresh session (with no memory of how the backend was built) can pick it up and start immediately — it assumes only that the backend exists and works as described here and in `docs/API_REFERENCE.md`.

---

## Before you start

**Read `docs/API_REFERENCE.md` first** — it has the full endpoint list, permission requirements, and role legend. This document tells you *what screens to build and what each one needs*; that one tells you *exactly how to call the API*.

**Tech stack** (from the original project spec): React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Zustand, React Hook Form, Zod, FullCalendar, Framer Motion.

**How the backend is set up:**
- Node API at `http://localhost:5000/api/v1` — start it with `cd backend && npm run dev`
- Python scheduling service at `http://localhost:8000` — start it with `cd scheduling-service && ./venv/Scripts/python.exe -m uvicorn app.main:app --port 8000` (the frontend never calls this directly — only the Node API does)
- MongoDB must be running locally (`mongodb://localhost:27017/medishift`)
- Seed roles/permissions once with `cd backend && npm run seed` if the database is empty. Bootstrap login: `admin@medishift.local` / `ChangeMe123!`

**Auth model:** JWT access token in `Authorization: Bearer <token>` header. Access tokens expire in 15 minutes — implement silent refresh using `POST /auth/refresh` (refresh token comes back in the login/register response body, and is also set as an httpOnly cookie scoped to `/api/v1/auth`). Store the access token in memory (Zustand), not localStorage, to reduce XSS exposure; the refresh token can rely on the httpOnly cookie.

**Real-time:** Socket.io server is running but requires a JWT in the connection handshake: `io(url, { auth: { token: accessToken } })`. Without it, the connection is rejected. Listen for `notification` and `message:new` events.

**Role model:** 6 roles (`super_admin`, `hospital_admin`, `hr_manager`, `department_head`, `shift_coordinator`, `employee`), permissions come back from `GET /auth/me` as `role.permissions[]` (array of `{key, module}` objects — check `permissions.some(p => p.key === 'employee:view')`). Build a `usePermission('employee:view')` hook early; nearly every screen needs it to conditionally show/hide actions.

**A quirk worth knowing:** `GET /employees` returns MongoDB `_id` as `id` (not `_id`) in the JSON response — the backend's `toJSON` transform renames it. Use `.id` everywhere on the frontend, not `._id`.

---

## The 25 screens

### Auth (5 screens — build first, nothing else works without this)

**1. Login** — `/login`
- Form: email, password → `POST /auth/login`
- On success: store access token + user in Zustand, redirect to `/dashboard`
- Link to Forgot Password and Register

**2. Register** — `/register`
- Form: email, password, firstName, lastName, optional employeeId → `POST /auth/register`
- If `employeeId` is provided, it must match an existing Employee record's employeeId AND that employee's email must match exactly, or the API returns 400. This is how HR-provisioned employees "claim" their own login — most orgs create the Employee record first, then the employee registers. Consider a helper UI hint for this.
- On success: show "check your email to verify" message (don't auto-login — `isEmailVerified` will be false, though login isn't actually blocked by this, worth deciding whether you want to nag about it in the UI)

**3. Forgot Password** — `/forgot-password`
- Single email field → `POST /auth/forgot-password`
- Always show the same success message regardless of whether the email exists (the API deliberately doesn't reveal this, don't undo that on the frontend)

**4. Reset Password** — `/reset-password?token=...`
- Token comes from the emailed link (query param), new password field → `POST /auth/reset-password`
- **Note:** email sending isn't configured (no SMTP credentials), so in dev the reset token is only visible in the backend's console logs, not an actual inbox. You'll need to grab it from the terminal running `npm run dev` to test this flow locally.

**5. Verify Email** — `/verify-email?token=...`
- Lightweight landing page, calls `POST /auth/verify-email` on mount, shows success/failure
- Same SMTP caveat as above

---

### Dashboard (1 screen)

**6. Dashboard** — `/dashboard`
- One route, content varies by role (don't build 3 separate pages — branch on `user.role.name` or better, on specific permissions)
- Data: `GET /reports/dashboard` (attendance %, late %, leave %, overtime hours, upcoming coverage %, open shifts next 14 days)
- Employee view: also show their own upcoming shifts (`GET /schedules?department=...` + shift lookups, or simpler — add a "my upcoming shifts" concept client-side by filtering), leave balance, unread notification count
- Manager/Admin view: pending leave requests needing approval, team stats, staffing warnings from the dashboard summary

---

### Employees (2 screens + embedded document management)

**7. Employees List** — `/employees`
- Table with search (`?search=`), filters (`?department=`, `?position=`, `?status=`, `?employmentType=`), pagination
- Requires `employee:view` — hide this nav item entirely for roles without it (i.e. `employee` role)
- Row actions gated by `employee:edit` / `employee:delete`

**8. Employee Detail / Edit** — `/employees/:id`
- View + edit form (`GET /employees/:id`, `PUT /employees/:id`) — gated by `employee:edit`
- Salary field: the API hides `salary` by default (`select: false` in the schema) — it will not appear in the response unless you explicitly know to request it differently server-side. As currently built, **salary is not retrievable via the API at all**. Don't build a salary display/edit field expecting it to work; flag this as a backend gap if you need it.
- Documents section: list (`GET /employees/:id/documents`), upload (`POST /employees/:id/documents`, `multipart/form-data` with fields `file` and `type` — type must be one of `resume|contract|government_id|medical_license|certification|training_certificate|other`), delete (`DELETE /documents/:id`). Max 10MB, PDF/DOC/DOCX/JPEG/PNG/WEBP only.
- Certifications section: shown as part of the employee record (`certifications[]` array with certification ref + issued/expiry dates) — there's no dedicated endpoint to add/remove one certification from an employee; it's part of the general `PUT /employees/:id` body.

---

### Departments (2 screens)

**9. Departments List** — `/departments`
- `GET /departments`, gated by `department:view`

**10. Department Detail** — `/departments/:id`
- `GET /departments/:id` (includes employee roster), `GET /departments/:id/stats` (headcount, employment-type breakdown)
- Manager assignment: `POST /departments/:id/manager` — note the employee must already belong to this department OR have no department at all (the API auto-assigns them if unset, but rejects if they belong to a *different* department)
- Bulk employee assignment: `POST /departments/:id/employees` with `employeeIds[]`
- Staffing requirements editor: part of `PUT /departments/:id` body — an array of `{shiftType, minStaff, requiredCertifications[]}`. **This directly drives the AI scheduler** — if you build nothing else carefully, get this UI right, since it's what `POST /schedules/:id/generate` reads to auto-create shifts. Note: only `morning`/`afternoon`/`night` (weekday-only) and `weekend` (Sat/Sun-only) staffing-requirement types get auto-expanded into shifts; `holiday`/`on_call`/`overtime`/`half_day` requirements are accepted but never auto-generate shifts (shifts of those types must be created manually).

---

### Positions & Certifications (2 screens)

**11. Positions** — `/positions`
- Simple CRUD, likely a list + modal form (title, salary range, required certifications, required skills, default hours/week)
- `GET/POST/PUT/DELETE /positions`, gated by `position:manage` for writes

**12. Certifications** — `/certifications`
- Same pattern (name, code, issuing body, validity period)
- `GET/POST/PUT/DELETE /certifications`, gated by `certification:manage`

---

### Scheduling (2 screens — the flagship feature)

**13. Schedules List** — `/schedules`
- `GET /schedules?department=&month=&year=&status=`
- "Create Schedule" button → `POST /schedules` (department + month + year → auto-computes date range)

**14. Schedule Detail / Calendar** — `/schedules/:id`
- This is the big one. Use FullCalendar in month view, shifts as events.
- `GET /schedules/:id` returns the schedule with `shifts[]` populated, each shift with `assignments[]` (populated with employee info)
- **The AI Generate button**: `POST /schedules/:id/generate` — this is synchronous and can take a few seconds (calls the Python OR-Tools solver). Show a loading state. Response includes `generation.status` (`OPTIMAL`/`FEASIBLE`/`INFEASIBLE`), `generation.unfilledShifts[]` (shifts the solver couldn't fully staff — display these prominently, they're actionable), and `generation.stats` (coverage %, solve time).
- If the schedule has zero shifts, Generate auto-creates them from the department's staffing requirements first (see Departments section 10) — so this button works even on a totally empty schedule, as long as staffing requirements are configured.
- Manual shift creation/editing: `POST/PUT/DELETE /shifts` — **blocked once the schedule is published** (409 error), so disable these controls once `schedule.status === 'published'`.
- Manual assignment: `POST /shifts/:id/assignments` (checks certification match, double-booking, staffing cap server-side — surface these specific error messages, they're informative, e.g. "Employee does not hold the certification(s) required for this shift")
- Assignment status updates (confirm/decline/no-show): `PUT /shifts/:id/assignments/:assignmentId`
- Publish button: `POST /schedules/:id/publish` — requires at least one shift to exist, sends real-time notifications to every employee in the department. This is a one-way action in the current API (no "unpublish"), so consider a confirmation dialog.
- Consider a drag-and-drop shift assignment UI as a stretch goal (matches the original spec's "support drag-and-drop editing" — not required by the API, just a UX nicety on top of the assignment endpoints above)

---

### Attendance (1 screen)

**15. Attendance** — `/attendance`
- Self-service clock in/out/break widget for every user (`POST /attendance/clock-in|clock-out|break-start|break-end`) — no special permission needed for your own record (`attendance:record_own`), but note: **only one clock-in per calendar day** is allowed (second attempt returns 409)
- History table for managers/HR (`GET /attendance?employee=&dateFrom=&dateTo=&status=`, gated by `attendance:view`)
- Summary view (`GET /attendance/summary?employee=&dateFrom=&dateTo=`) — aggregated hours/status counts, good for a chart
- "Mark Absentees" admin action (`POST /attendance/mark-absentees`, gated by `attendance:manage`) — back-fills absent records for anyone scheduled today who never clocked in. This has no automatic trigger (no cron job exists) — it must be a manual button someone clicks, or you'll need to build a scheduled job separately.
- Late/overtime detection is automatic server-side based on the employee's scheduled shift that day — nothing to build here beyond displaying the resulting `status` field.

---

### Leave (1 screen)

**16. Leave Requests** — `/leave`
- Submit form: leaveType, startDate, endDate, reason → `POST /leave` (employeeId defaults to self; only HR/managers with `leave:approve` can submit on behalf of someone else)
- List: `GET /leave` — **automatically scoped server-side**: employees only ever see their own requests, no permission needed; anyone with `leave:view` sees everyone's. Build one list component, let the API do the filtering.
- Two-step approval workflow, both require `leave:approve`: `POST /leave/:id/department-approve` then `POST /leave/:id/hr-approve` (HR-approve is rejected with 409 if department-approve hasn't happened first — build the UI to reflect this two-stage state machine, e.g. disable the HR-approve button until status is `department_approved`)
- Reject: `POST /leave/:id/reject` with a required `rejectionReason`
- Cancel: `POST /leave/:id/cancel` — owner only, pending status only
- **Worth surfacing in the UI**: HR-approving leave automatically declines any overlapping shift assignments — consider showing a warning/preview of affected shifts before HR confirms approval, since this is a side effect they should be aware of.

---

### Shift Swaps (1 screen)

**17. Shift Swap Requests** — `/shift-swaps`
- Two swap types: "give away" a shift (no `targetShift`, just a `targetEmployee` optional — if omitted, it's an open request anyone can claim) or a direct trade (`targetShift` + `targetEmployee` both required, and the target employee must currently hold that target shift)
- Create: `POST /shift-swaps`
- List: `GET /shift-swaps` — scoped to requests you're involved in by default; `shift_swap:view` + `?employee=` widens it
- Accept (target employee only, or anyone for an open request): `POST /shift-swaps/:id/accept`
- Manager approval (`shift_swap:approve`, only after accepted): `POST /shift-swaps/:id/approve` — this is what actually swaps the ShiftAssignment records
- Reject/cancel: `POST /shift-swaps/:id/reject` (with reason) / `POST /shift-swaps/:id/cancel` (requester, pending only)
- State machine to build UI around: `pending → accepted → manager_approved` (or `rejected`/`cancelled` at various points)

---

### Notifications (1 screen/component)

**18. Notifications** — likely a dropdown/panel, not a full page, but could be both
- `GET /notifications?isRead=true/false`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`
- Real-time: listen for the `notification` Socket.io event to push new ones in live without polling
- Fires automatically (server-side) on: schedule published, leave approved/rejected, shift swap requested/approved, announcement posted

---

### Announcements (1 screen)

**19. Announcements** — `/announcements`
- List: `GET /announcements` — auto-scoped to hospital-wide + your own department, no permission needed to view
- Create/edit/delete: gated by `announcement:manage` (scope = `hospital` or `department`, priority = `normal`/`important`/`emergency`)
- Consider visually distinguishing priority levels (emergency should stand out)

---

### Messages (1 screen)

**20. Messages** — `/messages`
- Two conversation types: direct (`GET /messages/direct/:userId`) and department group chat (`GET /messages/department/:departmentId`)
- Send: `POST /messages` (`conversationType: 'direct'|'department'`, plus `recipient` or `department`, plus `content`)
- Real-time: listen for `message:new` Socket.io event; also join department rooms via the `department:join` socket event to receive department chat messages
- Mark read: `PUT /messages/:id/read`
- **Note**: not every role has `message:send` by default — currently `hr_manager` does not (only `employee`, `department_head`, `shift_coordinator`, and the admin roles do). Verify this is the behavior you want; if not, it's a one-line permission-seed change on the backend, not a frontend concern.

---

### Payroll (1 screen)

**21. Payroll** — `/payroll`
- Generate: `POST /payroll/generate` (periodStart, periodEnd, optional department) — computes hours/overtime/night-differential/tardiness/undertime/absences per employee from their attendance records for that period. Gated by `payroll:manage`.
- List/detail: `GET /payroll`, `GET /payroll/:id`, gated by `payroll:view`
- Export: `GET /payroll/export?periodStart=&periodEnd=` — **CSV only**, triggers a file download (no Excel/PDF yet — flag this as a known gap if the client needs it)
- Finalize: `PUT /payroll/:id/finalize` — locks the record, gated by `payroll:manage`

---

### Reports & Analytics (1 screen)

**22. Reports & Analytics** — `/reports`
- Five chart-ready endpoints, all gated by `report:view` or `analytics:view`: `/attendance-trends`, `/leave-statistics`, `/overtime-trends`, `/shift-coverage`, `/department-utilization` — each takes `?dateFrom=&dateTo=` (and `?department=` where relevant)
- Good candidates for a tabbed layout or a dashboard-style grid of charts
- This is distinct from the main Dashboard (#6) — that one's a fixed-window summary; this page lets the user pick arbitrary date ranges and drill into specific metrics

---

### Profile (1 screen)

**23. Profile** — `/profile`
- `GET /employees/me`, `PUT /employees/me` — **only accepts `phone`, `photo`, `address`, `emergencyContact`**. The API uses `.strict()` validation, so sending any other field (department, salary, status, etc.) returns a 422 — don't build a form that tries to let users edit fields the API will reject.
- `POST /auth/change-password` (current password + new password) — belongs on this page too
- If the logged-in user has no linked Employee record (e.g., an admin account created without one), `GET /employees/me` returns 400 — handle this gracefully (hide the profile-editing section, or show account-only info from `GET /auth/me` instead)
- Own documents can also be managed here via the same `/employees/:id/documents` endpoints as the Employee Detail page (section 8) — self-upload doesn't require `employee:edit`

---

### Settings (1 screen)

**24. Settings** — `/settings`
- `GET/PUT/DELETE /settings/:key`, `GET /settings` (list) — gated by `system_settings:manage`, which **only `super_admin` has by default** (not even `hospital_admin`). Hide this nav item for everyone else.
- This is a raw key-value store, not a fixed schema — the UI needs to let an admin add arbitrary `{key, value, description}` entries, or you can hardcode a small set of known setting keys (e.g. `hospital.name`, `max-upload-mb`) with typed inputs if you'd rather not build a fully generic key-value editor
- Keys starting with `counter:` are blocked by the API (used internally for sequential employee IDs) — don't let the UI attempt to create/edit those

---

### Audit Logs (1 screen)

**25. Audit Logs** — `/audit-logs`
- `GET /audit-logs?entityType=&entityId=&user=&action=&dateFrom=&dateTo=` — gated by `audit_log:view` (`super_admin`/`hospital_admin` only)
- Currently only covers: Employee create/update/delete, Department create/update/delete, Leave approve/reject, Schedule publish, Payroll finalize, Document upload/delete. **Not every action in the system is logged** — don't present this as a complete history, frame it as "sensitive actions" in the UI copy
- Each entry has `action`, `entityType`, `entityId`, `user` (populated with email), `after` (resulting state as JSON — consider a collapsible/formatted JSON viewer), `ipAddress`, `userAgent`, `createdAt`

---

## Suggested build order

Matches how the backend itself was built — foundation first, flagship feature next, everything else after:

1. **Auth shell** (screens 1–5) + protected routing + the `usePermission` hook + API client with auto-refresh. Nothing else works without this.
2. **Core layout + Dashboard** (screen 6) + Employees/Departments/Positions/Certifications (screens 7–12) — the data everything else depends on existing.
3. **Scheduling** (screens 13–14) — the flagship feature, and the most complex screen in the app (FullCalendar + AI generate flow).
4. **Attendance, Leave, Shift Swaps** (screens 15–17) — the day-to-day workforce workflows, and the approval state machines.
5. **Notifications, Announcements, Messages** (screens 18–20) — real-time features, wire up Socket.io here.
6. **Payroll, Reports, Profile** (screens 21–23) — lower-urgency, mostly read-heavy.
7. **Settings, Audit Logs** (screens 24–25) — admin-only, lowest priority, smallest screens.

## A note on what's *not* here

Two things from the original spec still don't have backend support and are deliberately excluded from this 25: **Excel/PDF payroll export** (CSV only) and a **holiday calendar** for auto-scheduling `holiday`/`on_call`/`overtime`/`half_day` shifts (those shift types must be created manually). Building frontend UI for either would have nothing real to call. The **AI Assistant** (natural-language schedule Q&A) also isn't here — it's a separate, not-yet-started feature, not a gap in this screen count.
