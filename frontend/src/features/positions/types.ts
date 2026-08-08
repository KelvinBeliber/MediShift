export interface Position {
  id: string
  title: string
  description?: string
  salaryRange?: { min: number; max: number }
  requiredCertifications: { id: string; name: string; code: string }[] | string[]
  requiredSkills: string[]
  defaultWorkingHoursPerWeek: number
  isActive: boolean
}

export interface PositionInput {
  title: string
  description?: string
  salaryRange?: { min: number; max: number }
  requiredCertifications?: string[]
  requiredSkills?: string[]
  defaultWorkingHoursPerWeek?: number
}
