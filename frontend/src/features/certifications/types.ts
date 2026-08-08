export interface Certification {
  id: string
  name: string
  code: string
  description?: string
  issuingBody?: string
  validityPeriodMonths?: number
  isActive: boolean
}

export interface CertificationInput {
  name: string
  code: string
  description?: string
  issuingBody?: string
  validityPeriodMonths?: number
}
