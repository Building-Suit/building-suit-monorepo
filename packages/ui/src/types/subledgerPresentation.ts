import type { BsFxChoices, BsFxCopy, BsFxView } from './foreignExchangePresentation'
export interface BsSubledgerForm { party: string; control: string; offset: string; date: string; due: string; reference: string; amount: string; reason: string; allocations: Record<string, string> }
export interface BsSubledgerFilters { from: string; asOf: string; party: string; density: 'compact' | 'comfortable' }
export interface BsSubledgerChoice { value: string; label: string }
export interface BsSubledgerCopy { title: string; policy: string; contextLabel: string; denied: string; from: string; asOf: string; party: string; allParties: string; density: string; compact: string; comfortable: string; loadError: string; retry: string; setup: string; accounts: string; openItems: string; reference: string; issueDate: string; dueDate: string; original: string; outstanding: string; aging: string; empty: string; agingPolicy: string; statement: string; chooseParty: string; date: string; kind: string; movement: string; balance: string; reason: string; history: string; journal: string; reverses: string; reverse: string; reconciliation: string; reconciliationPolicy: string; control: string; glBalance: string; subledgerBalance: string; variance: string; status: string; legacy: string; legacyPolicy: string; cashSettled: string; reversalPolicy: string; amount: string; allocations: string; allocationPolicy: string; noAllocationItems: string; save: string; cancel: string; scroll: string }
export interface BsSubledgerView {
  context: { label: string; value: string }[]; allowed: boolean; loading: boolean; error: boolean; found: boolean; preferenceReady: boolean; setupRequired: boolean; actions: { id: string; label: string; disabled: boolean }[]
  items: { id: string; name: string; reference: string; issueDate: string; dueDate: string; original: string; outstanding: string; aging: string }[]
  aging: { id: string; label: string; value: string }[]; totals: { id: string; label: string; value: string }[]; statementAvailable: boolean
  movements: { id: string; date: string; reference: string; kind: string; movement: string; balance: string; reason: string; journalTo: string; reverses: string; canReverse: boolean; disabled: boolean }[]
  showReconciliation: boolean; reconciliation: { id: string; name: string; gl: string; subledger: string; variance: string; status: string; explanation: string }[]
  showLegacy: boolean; legacy: { id: string; reference: string; original: string; settled: string; outstanding: string }[]
  dialog: { title: string; dirty: boolean; pending: boolean; error: string; disabled: boolean; reversal: boolean; showDue: boolean; showReason: boolean; showAllocations: boolean; amountError: string; offsetLabel: string; allocationItems: { id: string; reference: string; outstanding: string }[] }
  fx: { copy: BsFxCopy; view: BsFxView; choices: BsFxChoices }
}
export interface BsSubledgerChoices { parties: BsSubledgerChoice[]; activeParties: BsSubledgerChoice[]; controls: BsSubledgerChoice[]; offsets: BsSubledgerChoice[] }
