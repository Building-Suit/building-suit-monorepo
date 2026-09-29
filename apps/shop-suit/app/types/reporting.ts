export type OperationalReportKind =
  | 'sales'
  | 'collections'
  | 'receivables'
  | 'suppliers'
  | 'expenses'
  | 'inventory'
  | 'margin'
  | 'activity'

export type OperationalReportRow = Record<string, string | number | boolean | null>

export interface OperationalReportPage {
  report: OperationalReportKind
  locationId: string | null
  fromDate: string | null
  toDate: string | null
  timezone: 'Africa/Cairo'
  canViewCosts: boolean
  operationalOnly: true
  summary: Record<string, string | number | boolean | null>
  items: OperationalReportRow[]
  total: number
  page: number
  pageSize: number
}
