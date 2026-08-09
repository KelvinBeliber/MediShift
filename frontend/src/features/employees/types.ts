export interface EmployeeRef {
  id: string
  name: string
  code?: string
  title?: string
}

export interface EmployeeCertification {
  certification: { id: string; name: string; code: string } | string
  issuedDate?: string
  expiryDate?: string
  documentUrl?: string
}

export interface Employee {
  id: string
  employeeId: string
  /** The linked login account's User id, when this employee has claimed one — see Messages, which sends to Users, not Employees. */
  user?: string
  firstName: string
  lastName: string
  fullName?: string
  photo?: string
  email: string
  phone?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  emergencyContact?: {
    name?: string
    relationship?: string
    phone?: string
  }
  department?: { id: string; name: string; code: string } | null
  position?: { id: string; title: string } | null
  employmentType: 'full_time' | 'part_time' | 'contract' | 'per_diem' | 'intern'
  hireDate: string
  /** Only present when the caller holds `employee:edit` — `select: false` server-side otherwise. */
  salary?: number
  status: 'active' | 'inactive' | 'on_leave' | 'terminated'
  skills: string[]
  certifications: EmployeeCertification[]
  medicalLicenseNumber?: string
  documents: string[]
}

export interface EmployeeDocument {
  id: string
  owner: string
  type: string
  fileName: string
  url: string
  mimeType?: string
  sizeBytes?: number
  uploadedBy: string
  expiryDate?: string
  createdAt: string
}

export const DOCUMENT_TYPES = [
  'resume',
  'contract',
  'government_id',
  'medical_license',
  'certification',
  'training_certificate',
  'other',
] as const

/** `GET /employees/directory` — name/department only, open to any authenticated user. See Messages' "New" picker. */
export interface DirectoryEmployee {
  id: string
  user?: string
  firstName: string
  lastName: string
  department?: { id: string; name: string } | null
  position?: { id: string; title: string } | null
}

export interface EmployeeListFilters {
  search?: string
  department?: string
  position?: string
  status?: string
  employmentType?: string
  page?: number
  limit?: number
}

/**
 * `PUT /employees/me` uses `.strict()` validation and accepts only these four
 * fields — anything else (department, salary, status…) is a 422. A separate
 * type from `EmployeeInput` on purpose, so the self-service form can't drift
 * into sending fields the API will reject.
 */
export interface UpdateOwnProfileInput {
  phone?: string
  photo?: string
  address?: Employee['address']
  emergencyContact?: Employee['emergencyContact']
}

export interface EmployeeInput {
  employeeId?: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  photo?: string
  department?: string
  position?: string
  employmentType: Employee['employmentType']
  hireDate: string
  salary?: number
  status?: Employee['status']
  skills?: string[]
  medicalLicenseNumber?: string
}
