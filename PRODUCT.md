# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hospital workforce staff and the people who schedule them. Six roles, defined in the database and seeded from `backend/src/constants/`:

- **employee** — nurses, doctors, technicians. Views their own schedule, clocks in and out, requests leave and shift swaps. The largest population and the least patient: they open the app mid-shift, often on a shared ward workstation, usually to answer one question ("when am I on?") before getting back to a patient.
- **shift_coordinator** — builds and AI-generates schedules, approves swaps.
- **department_head** — owns one department's staff, schedule, and first-stage leave approvals.
- **hr_manager** — employees, positions, certifications, second-stage leave approval, payroll, announcements.
- **hospital_admin** / **super_admin** — everything, and system settings respectively.

Accounts are **HR-provisioned, then claimed**: HR creates the Employee record first; the person registers against it with their employee ID and matching email to link a login to it. Self-registration without that link produces an account with no schedule and no profile.

## Product Purpose

MediShift builds hospital staff schedules that satisfy real constraints — certification requirements, minimum staffing per shift, double-booking, approved leave — and then runs the day-to-day workforce operations around them: attendance, leave, shift swaps, payroll inputs, and reporting.

Success is a published monthly schedule that a department head did not have to hand-assemble in a spreadsheet, and that no one has to renegotiate because it put an uncertified nurse in the ICU.

## Positioning

The scheduling engine is a real **Google OR-Tools CP-SAT constraint solver** running as a separate Python service, not a heuristic or a template filler. It returns a solver status (`OPTIMAL` / `FEASIBLE` / `INFEASIBLE`), the specific shifts it could not fully staff, and coverage statistics. When it cannot satisfy the constraints it says so and shows which shifts failed, rather than silently producing a schedule that violates them.

That honesty about infeasibility is the differentiator. A scheduling tool that always returns *something* is not solving the problem.

## Operating Context

- **The day is three shifts.** `morning 07:00–15:00`, `afternoon 15:00–23:00`, `night 23:00–07:00`, defined at `backend/src/services/scheduling/constraintBuilder.ts:11`. Plus `weekend`, and `holiday` / `on_call` / `overtime` / `half_day`, which exist as types but are created manually — there is no holiday calendar yet.
- Schedules are per-department, per-month, and move `draft → generated → published`. Publishing is one-way and notifies every employee in the department; shift edits are rejected with a 409 afterwards.
- Leave is a two-stage state machine: department approval, then HR approval. HR approval automatically declines any overlapping shift assignments.
- Shift swaps: `pending → accepted → manager_approved`.
- Staffing requirements live on the Department and are what the AI generator reads to auto-create shifts. Getting that editor right matters more than any other configuration screen.
- Real-time notifications and messaging over Socket.io, authenticated by JWT in the connection handshake.

## Capabilities and Constraints

Backend is complete and tested (214 passing tests) — see `docs/API_REFERENCE.md`. Frontend is 25 screens, built in the order in `docs/FRONTEND_STACK.md` §7.

Constraints that bind design work:

- **Access tokens expire in 15 minutes**; the access token is held in memory, never in localStorage. Silent refresh is mandatory.
- **CORS allows exactly one origin.** The dev server must run on port 5173.
- Every response is a `{ success, message, data }` envelope; 422s carry `details: [{ path, message }]` that map onto form fields.
- **Permissions gate nearly every screen.** They arrive only from `GET /auth/me` as objects with a `key`; the login response does not carry them.
- Auth endpoints are rate-limited to **20 requests / 15 minutes per IP**.
- **Password rule is minimum 8 characters. There is no complexity requirement** — the UI must not invent one.
- **No OAuth or SSO of any kind exists.** Password auth only. Adding a provider is backend work, not a frontend button.
- **No SMTP is configured in development.** Verification and reset links are printed to the backend console, never delivered. There is also **no resend-verification endpoint**, so an expired 24-hour link is a dead end.
- Undecided: whether payroll ever needs Excel/PDF export, whether a holiday calendar gets built, and whether SSO becomes a requirement.

Known backend gaps that constrain the UI: `firstName` / `lastName` are accepted by `POST /auth/register` and then discarded (the `User` model has no name fields); `salary` is not retrievable through the API at all.

## Brand Commitments

- **Name:** MediShift. **Tagline:** "Smarter Schedules. Better Care."
- The wordmark sets **Medi** in deep navy and **Shift** in teal, with a cross replacing the dot of the *i*. The logo mark is a circular ring sweeping teal → blue → violet around three caregiver figures over an M.
- Supplied assets (binding): `MediShift Login Illustration.png` — a portrait brand poster carrying the logo, wordmark, tagline, and an illustration of three clinicians at a schedule board; `MediShift Logo.png`; `MediText.png` (wordmark, transparent).
- The login screen is pinned by the user to a two-panel split: the poster occupies the left half, the form the right.

## Evidence on Hand

- A working, tested backend and Python solver, both runnable locally. Bootstrap login `admin@medishift.local` / `ChangeMe123!` after `npm run seed`.
- The three brand assets above, in `C:\Users\Ritchie\Desktop\Medimages\`. `MediShift Logo.png` has **no alpha channel** — it is a white rectangle and needs a transparent export to sit on tinted surfaces.
- `docs/API_REFERENCE.md`, `docs/FRONTEND_SCREENS.md`, `docs/FRONTEND_STACK.md`.

There are no customers, no deployment, no benchmarks, and no testimonials. Nothing may claim otherwise.

## Product Principles

1. **Say when it did not work.** Infeasible schedules, unfilled shifts, rejected assignments, and expired links get named specifically, with the reason and the recovery. The backend already writes actionable error copy; surface it verbatim rather than replacing it with a generic toast.
2. **The task outranks the interface.** People use this between patients. Speed, scanability, and familiar affordances beat expression on every authenticated surface.
3. **Permissions are structural, not cosmetic.** A control the user cannot use is not disabled, it is absent.
4. **Never invent product facts to fill a screen.** Shift windows, staffing rules, and role capabilities come from the backend. If a value is not real, it is not displayed.
5. **Provisioning flows one way.** HR creates the record; the employee claims it. UI that lets someone route around that is a security regression, not a convenience.

## Accessibility & Inclusion

Staff use this on shared ward workstations at every hour, including night shift, and often under time pressure. Target **WCAG 2.1 AA**: 4.5:1 for body text, visible keyboard focus on every control, full keyboard operability, and touch targets of at least 44px for shared tablets. Error states must be announced, not only colored.
