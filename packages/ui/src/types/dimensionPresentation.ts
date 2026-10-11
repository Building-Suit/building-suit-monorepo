export interface BsDimensionValueView {
  id: string
  kindLabel: string
  code: string
  name: string
  statusLabel: string
  editable: boolean
}
export interface BsDimensionPolicyView {
  id: string
  accountName: string
  kindLabel: string
  requirementLabel: string
}
export interface BsDimensionReportGroupView {
  id: string
  code: string
  name: string
  openingDebit: string
  openingCredit: string
  periodDebit: string
  periodCredit: string
}
export interface BsDimensionValueForm { id: string; kind: string; code: string; name: string; description: string }
export interface BsDimensionPolicyForm { accountId: string; kind: string; requirement: string }
export interface BsDimensionReportFilter { kind: string; report: string; from: string; to: string; valueId: string }
export interface BsDimensionsCopy {
  title: string; subtitle: string; denied: string; loadError: string; retry: string
  values: string; policies: string; policiesHint: string; add: string; edit: string; archive: string
  kind: string; code: string; name: string; description: string; status: string; empty: string
  account: string; requirement: string; reportType: string; from: string; to: string; filter: string; run: string
  reconciled: string; notReconciled: string; grouped: string
  openingDebit: string; openingCredit: string; periodDebit: string; periodCredit: string
  save: string; cancel: string
}
