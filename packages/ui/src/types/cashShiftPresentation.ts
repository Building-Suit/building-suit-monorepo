export interface BsCashShiftEventView { id: string; date: string; label: string; detail: string; actor: string; amount: string }
export interface BsCashShiftActiveView { cashier: string; opened: string; metrics: { label: string; value: string }[]; events: BsCashShiftEventView[] }
export interface BsCashShiftHistoryRow { id: string; cashierName: string; opened: string; expected: string; counted: string; variance: string; nonCash: string }
export interface BsCashShiftAmountForm { amount: number; notes: string }
export interface BsCashShiftMovementForm { kind: string; amount: number; reason: string; reference: string }
export interface BsCashShiftEditor { dirty: boolean; pending: boolean }
export interface BsCashShiftCopy {
  title: string
  subtitle: string
  branch: string
  noShop: string
  noLocation: string
  loadError: string
  retry: string
  loading: string
  active: string
  open: string
  movement: string
  close: string
  noActive: string
  eventHistory: string
  date: string
  event: string
  actor: string
  amount: string
  empty: string
  history: string
  cashier: string
  allCashiers: string
  opened: string
  expected: string
  counted: string
  variance: string
  nonCash: string
  openAction: string
  cancel: string
  openingCash: string
  openingNotes: string
  record: string
  reason: string
  reference: string
  closeAction: string
  closeNotes: string
}
