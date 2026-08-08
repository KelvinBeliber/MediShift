# MediShift Frontend — Tech Stack & Architecture Decisions

Companion to `docs/FRONTEND_SCREENS.md` (what to build) and `docs/API_REFERENCE.md` (how to call the API). This document records **what we chose, why, and what we deliberately rejected** — so a fresh session doesn't re-litigate settled decisions or walk into a known trap.

Decisions recorded: 2026-08-07.

---

## 1. Constraints the backend imposes

These aren't preferences — they're facts about the existing backend that the frontend must accommodate. Verified by reading the source, not assumed.

| Constraint | Where | What it means for the frontend |
|---|---|---|
| CORS allows exactly **one** origin, from `CLIENT_URL` (default `http://localhost:5173`) | `backend/src/app.ts:19` | Dev server must run on 5173. The same allowlist governs Socket.io (`backend/src/sockets/index.ts:24`). |
| Refresh cookie is `httpOnly` + **`sameSite: 'lax'`** | `backend/src/controllers/auth/auth.controller.ts:11` | Works on localhost and same-site deploys. **Breaks on cross-domain deploys** — see §6. |
| Every success response is `{ success, message, data, pagination? }` | `backend/src/utils/ApiResponse.ts` | Unwrap in exactly one place. Never let the envelope leak into components. |
| Every error is `{ success: false, message, details? }` | `backend/src/middleware/errorHandler.ts:44` | For 422s, `details` is `[{ path, message }]` — map straight onto React Hook Form field errors. |
| Access tokens expire in **15 minutes** | `.env.example` | Silent refresh is mandatory, not optional. |
| Backend uses **Zod v4**, TS 5.9, Node 22.16, socket.io 4.8 | `backend/package.json` | Match majors on the frontend to avoid two dialects of the same tool. |
| `toJSON` renames `_id` → `id` | noted in `FRONTEND_SCREENS.md:25` | Use `.id` everywhere. |

---

## 2. The stack

### Foundation

Versions below are what is actually installed, verified after scaffolding — not intentions. See §9 for where reality differed from the original plan.

| Layer | Choice | Rationale |
|---|---|---|
| Build tool | **Vite 8** | Current `create-vite` default. |
| Language | **TypeScript 5.9** (pinned) | Matches backend exactly. |
| UI runtime | **React 19** | |
| Routing | **React Router 7**, declarative/data mode (`createBrowserRouter`) | See §3 for why *not* framework mode. |
| Server state | **TanStack Query v5** | Caching, refetch, mutation invalidation. |
| Client state | **Zustand** — auth session only | See §3. |
| HTTP | **Axios** + interceptors | Silent refresh with a request queue is materially harder on bare `fetch`. This is the one dependency worth taking for ergonomics alone. |
| Forms | **React Hook Form + Zod v4** | Zod major matches the backend's validators. |
| Styling | **Tailwind CSS v4** | |
| Components | **shadcn/ui** (Radix primitives) | Copy-in, not a dependency — we own the code. |
| Tables | **TanStack Table v8** | Employees, attendance, payroll, and audit logs are all the same problem. |
| Charts | **Bklit UI** (visx + d3 under the hood) | See §4. |
| Calendar | **FullCalendar 6.1.21**, exact-pinned, free MIT plugins only | See §5. |
| Realtime | **socket.io-client 4.8** | Pinned to the server's major. |
| Dates | **date-fns v4** | Composes well with FullCalendar. |
| Motion | **`motion`** | Framer Motion's current package name. Use sparingly. |
| Toasts | **sonner** | |

### Tooling

| Concern | Choice |
|---|---|
| Unit/component tests | **Vitest 4 + React Testing Library** |
| API mocking | **MSW** — critical here; lets us fake the envelope and permission gating deterministically |
| Lint | **oxlint** (`create-vite` default; vendored `ui/` and `charts/` are ignored) |
| Format | **Prettier** — no semicolons, single quotes, 100 cols |

---

## 3. Architectural decisions

### 3.1 The API layer is the highest-risk code in the project

Roughly 60% of the difficulty across all 25 screens lives in one folder. Build and test it **before screen 1**. It must handle:

1. **Envelope unwrapping** — components receive `data`, never `{ success, message, data }`.
2. **Silent refresh with a request queue** — when the 15-minute access token expires, a dashboard firing five parallel queries must trigger **one** refresh, with the other four queued and replayed. Naive per-request refresh causes a thundering herd and race conditions on the refresh token.
3. **422 → form errors** — map `details[{path, message}]` onto RHF's `setError`.
4. **Preserving informative errors** — the backend deliberately writes actionable messages (e.g. *"Employee does not hold the certification(s) required for this shift"*). Surface these verbatim; don't replace them with a generic toast.

### 3.2 Zustand holds the auth session and nothing else

Access token (in memory, **not** localStorage — reduces XSS exposure), the current user, and their permissions. Everything else is server state and belongs to TanStack Query. Mirroring server data into Zustand is the single most common way this class of app rots.

### 3.3 `usePermission` is infrastructure, not a utility

`GET /auth/me` returns `role.permissions[]` as `{ key, module }` objects. Wrap it in a hook backed by a **typed union of the 36 permission keys**, so `usePermission('employe:view')` is a compile error rather than a silently-always-false check. Both route guards and nav visibility derive from it.

### 3.4 Routing: React Router 7 in declarative mode, not framework mode

React Router 7's framework mode is the Remix-style, SSR-oriented path with its own build pipeline and loader conventions. That's the wrong shape for an SPA that holds its access token **in memory** — loaders running before hydration have no token, and SSR buys nothing for an authenticated internal tool. Use `createBrowserRouter` with component-level data fetching via TanStack Query.

### 3.5 No shared monorepo package; hand-written frontend types

Tempting, since the backend is also Zod v4 — but the backend is CommonJS with `tsconfig-paths` aliases, and wiring a shared workspace into that costs more than it returns for a solo build.

**Accepted risk:** frontend types can drift from the API and you find out at runtime. **The upgrade path if that becomes painful:** add an OpenAPI spec to the backend and codegen types + schemas from it. That's a backend task, deliberately deferred.

---

## 4. Charts: Bklit UI

[Bklit UI](https://github.com/bklit/bklit-ui) is a **shadcn registry**, installed via `npx shadcn@latest add @bklit/line-chart` — the same pipeline as the rest of our components, not an npm runtime dependency. Chart components are MIT (only Bklit Studio, the web playground, is proprietary).

Chosen over Recharts-direct because the install path is already in use and the chart code lands in our repo — if a chart doesn't fit the reports screen, we edit it instead of fighting a library API.

Installed: `line-chart`, `bar-chart`, `area-chart`, `pie-chart`. Covers what the five report endpoints and the dashboard need.

**Resolved at install — the engine is visx + d3, not Recharts.** Installing Bklit pulled in nine `@visx/*` packages plus `d3-array`/`d3-shape`. Two consequences worth knowing:

- The `@visx/*` packages resolve to **`4.0.1-alpha.0`** — a prerelease. This is visx's own publishing state, not Bklit's doing, but it means our chart layer sits on alpha dependencies. If charts misbehave, suspect this first.
- Chart code is visx/d3, so extending a chart means writing visx, not Recharts. Budget accordingly — it's lower-level and more verbose.

**Two registry bugs were found and fixed by hand at install.** If you re-run `shadcn add @bklit/*` and things break, re-apply these:

1. The generated `@theme inline` block in `src/index.css` referenced its variables with **four** leading dashes (`var(----chart-scale-05)`) against two-dash definitions (`--chart-scale-05`). All 21 occurrences would have silently resolved to nothing. Fixed by rewriting `var(----` → `var(--`.
2. `src/components/charts/chart-loading-label.tsx` imported `../components/shimmering-text`, which resolves to `src/components/components/…`. The file is actually installed at `src/components/shimmering-text.tsx`. Fixed by rewriting the import to `@/components/shimmering-text`.

Both are the kind of thing the copy-in model makes trivially fixable — which is the argument for it.

---

## 5. Calendar: FullCalendar free plugins only

Month/week/day/list grid views plus `interaction`, all MIT.

**All six packages are exact-pinned to `6.1.21`.** FullCalendar is mid-major-release and its packages are out of step: `@fullcalendar/core` and `@fullcalendar/react` have shipped `7.0.2` stable, but the view plugins (`daygrid`, `timegrid`, `list`, `interaction`) top out at `7.0.0-rc.0`. A default `npm install` therefore resolves a **split install** — core/react on 7.x against plugins on 6.x — which FullCalendar does not support. Do not run `npm update` on these without re-checking that all six agree; revisit once the v7 plugins go stable.

**Rejected: FullCalendar Premium.** The spec's "Timeline" view (`README.md:190`) is `resource-timeline` — a paid, per-developer, annually-renewed commercial license. Not justified for this project.

**Deferred, not rejected: a custom timeline.** An employee-rows × days CSS-grid view is the genuinely right lens for reviewing an AI-generated schedule (consecutive-day patterns and coverage gaps become visible at a glance), and it would look *better* than Premium because it inherits our design system instead of requiring `.fc-*` overrides.

It is deferred because it is not cheap — sticky first column, horizontal scroll sync across ~31 columns, same-day overlap stacking, drag-drop, and virtualization past ~60 employees — and it would land on screen 14, already the hardest screen in the build. Revisit as an **additive second view toggle** after screens 13–14 work end to end.

In the meantime, `generation.unfilledShifts[]` rendered as a prominent warning list delivers most of the schedule-review value, and is more actionable than eyeballing a grid.

### Calendar behaviour note

Shift writes are rejected with 409 once a schedule is published. Treat "published" as a first-class **read-only calendar mode** (drag-drop and edit controls disabled), not an afterthought error toast.

---

## 6. ⚠️ Known blocker: cross-domain refresh cookie

**Target deployment is different domains** (e.g. Vercel frontend + Render backend).

The refresh cookie is set with `sameSite: 'lax'` (`backend/src/controllers/auth/auth.controller.ts:14`), which browsers will **not** send on cross-site requests. Authentication will silently fail to persist on the first real deploy.

**Fix required before deploying** (a backend change, not a frontend one): set `sameSite: 'none', secure: true` when in production, keeping `lax` for local development so localhost keeps working over plain HTTP.

Not a blocker for frontend development — localhost:5173 → localhost:5000 is same-site, so the current setting works fine in dev.

---

## 7. Build order

Per `FRONTEND_SCREENS.md`, with the API layer made explicit as step 0:

0. **API layer + auth plumbing** — envelope unwrapping, refresh queue, `usePermission`, protected routing, Zustand session store.
1. **Auth screens** (1–5).
2. **Layout + Dashboard** (6) + **Employees/Departments/Positions/Certifications** (7–12).
3. **Scheduling** (13–14) — flagship feature, hardest screen.
4. **Attendance, Leave, Shift Swaps** (15–17) — approval state machines.
5. **Notifications, Announcements, Messages** (18–20) — wire up Socket.io here.
6. **Payroll, Reports, Profile** (21–23).
7. **Settings, Audit Logs** (24–25) — admin-only, smallest.

---

## 8. What the scaffold already contains

Step 0 of the build order is **done**. `frontend/` boots, typechecks, builds, and its tests pass.

```
frontend/src/
  app/
    providers.tsx     QueryClientProvider + Toaster
    router.tsx        all 25 routes, placeholders behind permission guards
    guards.tsx        RequireAuth / RequireAnonymous / RequirePermission
  lib/
    api/
      client.ts       axios instance, token bridge, single-flight refresh, envelope helpers
      client.test.ts  6 tests, incl. the concurrent-refresh case
      errors.ts       ApiError + applyFieldErrors (422 → React Hook Form)
      types.ts        envelope + pagination types
    query.ts          QueryClient (4xx never retried)
    utils.ts          cn()
  features/auth/
    permissions.ts    all 36 permission keys as a literal union
    store.ts          Zustand session store
    usePermission.ts  usePermission / usePermissions / useAnyPermission
    useSession.ts     cold-load session restore via the refresh cookie
    api.ts, types.ts
  components/
    layout/AppLayout.tsx   sidebar, nav filtered by permission
    ui/                    shadcn (vendored)
    charts/                Bklit (vendored)
  routes/ScreenPlaceholder.tsx
  test/                    MSW setup
```

**Verified, not assumed:** `tsc -b` clean · `vite build` succeeds (428 kB / 136 kB gzip) · `oxlint` clean on our code · 6/6 tests pass · dev server boots on 5173 and an unauthenticated visit correctly falls through to `/login`.

Two design points worth not undoing:

- **The token bridge.** `client.ts` never imports the auth store; the store injects accessors via `connectTokenBridge`. This avoids a circular import between the store and the interceptors. `main.tsx` imports the store for its side effect *before* rendering — keep that import.
- **Session restore has no persisted token by design.** `useSessionBootstrap` calls `GET /auth/me` on cold load; the 401 → refresh → replay path in the interceptor mints a new access token from the httpOnly cookie. Guards render a spinner until this settles, so reloading a deep link doesn't bounce an authenticated user to `/login`.

### Running it

```bash
cd frontend && npm run dev
```

Scripts: `dev`, `build`, `typecheck`, `lint`, `format`, `test`, `test:watch`, `test:coverage`, `preview`.

The backend must be running on port 5000 for anything authenticated to work (`cd backend && npm run dev`).

---

## 9. Where reality differed from the plan

Recorded so these don't read as accidents later:

| Planned | Actual | Why |
|---|---|---|
| Vite 7 | **Vite 8** | Current `create-vite` default; no reason to downgrade. |
| ESLint 9 flat config | **oxlint** | Ships as the `create-vite` default now. Kept it — faster, and Prettier still handles formatting. |
| TypeScript (template default) | **pinned to 5.9** | The template offered TS 6.0. Pinned to match the backend and avoid ecosystem-compat surprises across shadcn/TanStack/visx. |
| Charts on Recharts | **visx + d3** | Bklit turned out to be visx-based. See §4. |
| `strict` assumed on | **added manually** | The generated `tsconfig.app.json` did not enable `strict`. Added, along with `noUncheckedIndexedAccess`. |

**Open advisory, assessed as not applicable:** `npm audit` reports a high-severity finding against `react-router` 7.12.0–8.2.0 ([GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)) — a CSRF bypass **in RSC mode**. We run declarative SPA mode with no RSC, so it is not reachable here. The only "fix" npm offers is a downgrade to 7.11.0; there is no patched newer release yet. Re-check when one ships rather than downgrading.

---

## 10. Deliberately out of scope

Carried forward from `FRONTEND_SCREENS.md:250` — these have no backend to call, so building UI for them would be building against nothing:

- **Excel/PDF payroll export** (CSV only exists)
- **Holiday calendar** for auto-scheduling `holiday`/`on_call`/`overtime`/`half_day` shifts
- **AI Assistant** (natural-language schedule Q&A) — a separate unstarted feature
