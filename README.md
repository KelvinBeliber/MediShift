# MediShift — AI-Powered Healthcare Workforce Management

MediShift is a full-stack workforce management platform for hospitals and healthcare organizations. It centralizes employee management, intelligent shift scheduling, attendance tracking, leave management, payroll preparation, and analytics into a single application.

The core feature is an AI-assisted scheduling engine powered by **Google OR-Tools CP-SAT**, which generates optimized monthly schedules while respecting staffing requirements, employee availability, labor regulations, certifications, and fairness constraints — and reports honestly when a schedule is infeasible instead of silently violating constraints.

## Architecture

MediShift runs as three services:

| Service | Stack | Default URL | Purpose |
|---|---|---|---|
| `backend/` | Node.js, Express, TypeScript, MongoDB | `http://localhost:5000` | Main API — auth, employees, schedules, attendance, leave, payroll, messaging (Socket.io) |
| `frontend/` | React, TypeScript, Vite | `http://localhost:5173` | Web application |
| `scheduling-service/` | Python, FastAPI, OR-Tools CP-SAT | `http://localhost:8000` | Internal-only solver. Only the Node API calls it — the frontend never talks to it directly |

```
Browser  ─────────────▶  Node/Express API  ─────────────▶  Python scheduling service
(React)     REST/WS        (backend/)         REST            (scheduling-service/)
                                │
                                ▼
                             MongoDB
```

## Tech Stack

**Frontend** — React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Zustand, React Hook Form, Zod, FullCalendar, Framer Motion

**Backend** — Node.js, Express.js, MongoDB, Mongoose, JWT Authentication, Socket.io, Cloudinary, Multer, Nodemailer, Redis (optional), BullMQ (optional)

**Scheduling service** — Python, FastAPI, Google OR-Tools (CP-SAT), Pydantic

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB (local instance or a connection string)

### 1. Backend API

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`. At minimum, set `MONGO_URI`. `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET` have development fallbacks, but **must** be set to unique, 32+ character values before running with `NODE_ENV=production` — the server refuses to boot in production without them. `CLOUDINARY_*` and `SMTP_*` are optional; document uploads and outbound email are disabled until they're configured. `ANTHROPIC_API_KEY` is optional too — set it to enable the [AI Assistant](#ai-assistant), which reports itself unconfigured without one (`ASSISTANT_MODEL` and `ASSISTANT_MAX_TOKENS` are optional overrides, defaulting to `claude-sonnet-4-6` and `8192`).

```bash
npm run seed        # roles, permissions, departments, positions, certifications
npm run seed:demo   # (optional) demo employees, schedules, and sample data
npm run dev          # http://localhost:5000
```

### 2. Scheduling service

```bash
cd scheduling-service
python -m venv venv
venv\Scripts\activate        # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

The `SCHEDULING_SERVICE_API_KEY` in `scheduling-service/.env` must match the same variable in `backend/.env`, or the Node API's schedule-generation requests will be rejected with a 401.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

`VITE_API_URL` must point at the backend's `/api/v1` prefix, and the backend's `CLIENT_URL` must match the Vite dev origin — the API only allows a single CORS origin.

### Default login

After `npm run seed`, a super admin account is created from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (set these in `backend/.env`, or check `backend/src/database/seed.ts` for the defaults used when they're omitted).

## Scripts

**Backend** (`backend/`)

| Command | Description |
|---|---|
| `npm run dev` | Start the API with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run seed` | Seed roles, permissions, departments, positions, certifications |
| `npm run seed:demo` | Seed demo employees and sample records |
| `npm run seed:full` | Seed a full dataset |
| `npm test` | Run the Jest test suite |
| `npm run test:coverage` | Run tests with coverage |

**Frontend** (`frontend/`)

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Lint with oxlint |
| `npm test` | Run the Vitest suite |
| `npm run test:coverage` | Run tests with coverage |

**Scheduling service** (`scheduling-service/`)

| Command | Description |
|---|---|
| `uvicorn app.main:app --reload --port 8000` | Start the FastAPI service with hot reload |
| `pytest` | Run the test suite (install `requirements-dev.txt` first) |

## Core Modules

### Authentication & Access Control
Login, registration, forgot/reset password, email verification, JWT access + refresh tokens, protected routes, role-based access control (RBAC).

Accounts are **HR-provisioned, then claimed**: HR creates the Employee record first, and the employee registers against it with their employee ID and matching email to link a login. Self-registration without that link produces an account with no schedule and no profile.

**Roles** — Super Admin, Hospital Administrator, HR Manager, Department Head, Shift Coordinator, Employee

### Dashboards
Role-specific dashboards:
- **Employee** — upcoming shifts, attendance summary, leave balance, notifications, schedule calendar
- **Manager** (Department Head / Shift Coordinator) — department schedule, pending leave requests, shift conflicts, attendance overview, team statistics
- **Admin** (Hospital Admin / Super Admin / HR Manager) — employee count, department overview, staffing levels, open shifts, overtime summary, hospital analytics

### Employee Management
Full CRUD with photo, employee ID, contact and emergency contact info, department, position, employment type, hire date, salary, status, skills, certifications, medical license number, and document uploads (resume, contract, government ID, medical license, certifications, training certificates) via Cloudinary.

### Department & Position Management
Departments (Emergency, ICU, Operating Room, Pediatrics, Radiology, Laboratory, Cardiology, Neurology, Pharmacy, Reception, Billing, Maintenance, Security) each carry a manager, staff list, schedule, and staffing requirements — the staffing requirements are what the AI generator reads to auto-create shifts.

Positions store salary range, required certifications, required skills, and default working hours.

### Certification Management
Certifications (ICU Certified, ACLS, BLS, Pediatric Certified, Trauma Certified, Radiology Certified, etc.) are enforced by the scheduling engine — e.g., only ICU-certified nurses can be scheduled into ICU shifts.

### Shift Management
Shift types: Morning (07:00–15:00), Afternoon (15:00–23:00), Night (23:00–07:00), Weekend, Holiday, On-Call, Overtime, Half Day. Daily/weekly/monthly/timeline calendar views with drag-and-drop editing.

Schedules move through `draft → generated → published` per department, per month. Publishing is one-way and notifies every employee in the department; shift edits are rejected afterward.

### AI Schedule Generator
The scheduling engine is a real Google OR-Tools CP-SAT constraint solver running as a separate Python service, not a heuristic or template filler. It accounts for:

employee availability, approved/sick leave, required certifications, department assignment, maximum weekly/monthly hours, minimum rest period, maximum consecutive work days, night shift rotation, weekend fairness, public holidays, employee preferences, overtime limits, required staffing levels, and labor regulations.

It returns a solver status (`OPTIMAL` / `FEASIBLE` / `INFEASIBLE`), which specific shifts could not be fully staffed, and coverage statistics — rather than silently producing a schedule that violates constraints. Managers review, edit, and publish the generated schedule.

### Attendance Management
Clock in/out, break start/end, attendance history. Statuses: Present, Late, Absent, Leave, Holiday, Overtime. Optional GPS verification and QR code attendance.

### Leave Management
Leave types: Vacation, Sick, Emergency, Maternity, Paternity, Bereavement, Study.

Two-stage approval: **Employee submits → Department Head reviews → HR approves → schedule updates automatically.** HR approval automatically declines any overlapping shift assignments.

### Shift Swap Requests
`pending → accepted → manager_approved`: employee requests a swap → another employee accepts → manager approves → schedule updates → both employees are notified.

### Payroll Preparation
Calculates total hours worked, overtime, night differential, holiday hours, tardiness, undertime, and absences. Exports to CSV, Excel, and PDF.

### Notifications
In-app, email, and browser notifications for: schedule published/changed, leave approved/rejected, shift swap approved, new announcement, upcoming shift reminder.

### Announcements
Hospital-wide and department-level announcements with priority levels (Normal, Important, Emergency).

### Internal Messaging
Real-time direct messages and department group chat over Socket.io, authenticated by JWT in the connection handshake.

### Reports & Analytics
Charts for attendance trends, leave statistics, overtime trends, staffing levels, and department utilization. Reports for attendance, leave, payroll summary, employee performance, and shift coverage — exportable to PDF and Excel.

### AI Assistant
A manager-facing chat, powered by Claude through the official `@anthropic-ai/sdk`, that answers workforce questions in plain language against live data. Example questions:

- Who worked the most overtime this month?
- Which department is most understaffed over the next two weeks?
- Why couldn't an employee be assigned to this shift?
- Whose certifications expire in the next 60 days?

Claude reaches the data through **seven specific, named tools** — departments, overtime summary, staffing levels, attendance summary, upcoming leave, expiring certifications, and per-shift eligibility — each backed by the same service functions the Reports screen already uses, so the assistant and the charts cannot disagree. Every answer lists the tools it was read from, so a figure can be traced to the query that produced it.

Four properties are enforced in code rather than by prompting, because a prompt is not a security boundary:

- **Read-only.** There is no tool that creates, updates, deletes, publishes, or approves anything, and no write-capable service is imported into the tool module. The capability does not exist to be misused — the assistant cannot generate a schedule, only explain one.
- **No raw query escape hatch.** Every tool is a fixed question with a validated argument shape. There is no "run this query" tool, so the set of answerable questions is exactly the set enumerated above.
- **Scoped server-side.** The caller's reach is resolved from their own account before Claude is invoked. Holders of `analytics:view` (HR Manager, Hospital Admin, Super Admin) see every department; a Department Head, who holds only `report:view`, is pinned to their own — if the model asks about another department, the request is silently replaced with theirs and the answer says so.
- **Salary is out of scope for every role.** It is excluded at the data-assembly layer by allowlisted projections, then scrubbed again from every assembled result on the way out. Prompting is not involved.

Gated on the same `report:view` / `analytics:view` permissions as Reports & Analytics, so Employees and Shift Coordinators cannot see or reach it. Rate-limited to **20 questions per hour per user** — keyed by user id rather than IP, since a hospital's staff share an outbound address. This is the only endpoint in MediShift that costs money per call.

Requires `ANTHROPIC_API_KEY`. Without it the rest of the app is unaffected and the screen says the feature is unconfigured rather than failing on send.

## Database Collections

`users`, `roles`, `permissions`, `departments`, `positions`, `certifications`, `employees`, `schedules`, `shifts`, `attendance`, `leaveRequests`, `shiftSwapRequests`, `announcements`, `notifications`, `messages`, `payrollInputs`, `documents`, `auditLogs`, `systemSettings`

## Documentation

- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) — full endpoint reference, auth model, roles & permissions legend
- [`docs/FRONTEND_STACK.md`](docs/FRONTEND_STACK.md) — frontend architecture and conventions
- [`docs/FRONTEND_SCREENS.md`](docs/FRONTEND_SCREENS.md) — screen-by-screen frontend spec

## Testing

```bash
cd backend && npm test
cd frontend && npm test
cd scheduling-service && pytest
```

## Future Enhancements

Multi-hospital support, SaaS subscriptions, Google Calendar integration, SMS notifications, face recognition attendance, mobile PWA, offline attendance sync, AI staffing forecasts, predictive staffing recommendations, and a voice-enabled AI assistant.
