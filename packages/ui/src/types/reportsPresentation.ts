export interface BsReportsCopy {
  allLocations: string
  costDenied: string
  denied: string
  empty: string
  export: string
  exporting: string
  failed: string
  fifoNotice: string
  from: string
  fullHistory: string
  loading: string
  location: string
  next: string
  of: string
  open: string
  operational: string
  page: string
  previous: string
  records: string
  retry: string
  subtitle: string
  title: string
  to: string
}
export interface BsReportChoice { value: string; label: string }
export interface BsReportColumn { key: string; label: string; primary: boolean }
export interface BsReportRow { id: string; cells: Record<string, string>; sourceTo: string }
export interface BsReportsView { workspace: string; exporting: boolean; exportDisabled: boolean; exportLabel: string; notice: string; detailNotice: string; dateDisabled: boolean; failed: boolean; exportError: string; loading: boolean; denied: boolean; restricted: boolean; summary: { id: string; label: string; value: string; to: string }[]; columns: BsReportColumn[]; rows: BsReportRow[]; total: number; pagination: string; previousDisabled: boolean; nextDisabled: boolean }
export interface BsReportFilters { report: string; location: string; from: string; to: string }
export interface BsReportChoices { reports: BsReportChoice[]; locations: BsReportChoice[] }
