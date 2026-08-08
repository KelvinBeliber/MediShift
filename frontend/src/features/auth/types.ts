import type { PermissionKey, RoleName } from './permissions'

export interface Permission {
  key: PermissionKey
  module: string
}

export interface Role {
  id: string
  name: RoleName
  description?: string
  permissions: Permission[]
}

/**
 * The linked Employee record, as `GET /auth/me` populates it.
 *
 * Absent entirely for accounts with no linked employee (e.g. the bootstrap
 * admin) — the backend omits the key rather than sending null, and
 * `GET /employees/me` returns 400 for those users.
 *
 * Only the fields the frontend actually reads are typed; the backend sends the
 * full document. `salary` is `select: false` server-side and never arrives.
 */
export interface LinkedEmployee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  /** Mongoose virtual. */
  fullName?: string
  email: string
  photo?: string
  /** Unpopulated ObjectId string — `auth.service.getMe()` doesn't sub-populate it. */
  department?: string
}

/**
 * The user as returned by `GET /auth/me` — the only endpoint that carries
 * permissions. `firstName`/`lastName` live on the `User` model itself (set at
 * registration) and are a fallback display name for accounts with no linked
 * `employee` — the linked Employee's name is still authoritative when present.
 */
export interface AuthUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  isEmailVerified: boolean
  isActive: boolean
  role: Role
  employee?: LinkedEmployee
  lastLoginAt?: string
}

/**
 * The user as returned by `POST /auth/login` — deliberately NOT `AuthUser`.
 *
 * Login sends `role` as a bare role-name string and carries no permissions at
 * all. Putting this object into the session store would leave `hasPermission()`
 * false forever and render an empty sidebar, so the login flow has to follow up
 * with `GET /auth/me`. See `useLogin`.
 */
export interface LoginUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role: RoleName
  isEmailVerified: boolean
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: LoginUser
}

/** `POST /auth/register` returns only these two fields, and issues no tokens. */
export interface RegisterResponse {
  id: string
  email: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  employeeId?: string
}
