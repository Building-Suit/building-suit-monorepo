import type { BsUsageItem } from '@building-suit/contracts'
export type BsJournalImportField = 'type' | 'date' | 'amount' | 'account' | 'category' | 'description' | 'reference' | 'counterparty' | 'currency' | 'exchange_rate'
export type BsJournalImportMapping = Record<BsJournalImportField, string>
export interface BsJournalImportForm { paste: string; mapping: BsJournalImportMapping; review: string }
export interface BsDocumentExtractionForm { reviewed: boolean; candidates: { values: BsJournalImportMapping }[] }
export interface BsDocumentExtractionCopy {
  title: string; hint: string; boundaryTitle: string; boundaryBody: string; documentLabel: string; documentHint: string; proposalLabel: string; proposalHint: string
  noErrors: string; evidence: string; attestation: string; incomplete: string; reject: string; accept: string; select: string; income: string; expense: string
  fields: Record<BsJournalImportField, string>
}
export interface BsDocumentExtractionView {
  visible: boolean; error: string; mismatch: string; source: string; resetKey: number; hasProposal: boolean; canAccept: boolean; incomplete: boolean
  candidates: { id: string; title: string; issues: { id: string; code: string; message: string }[]; fields: Record<BsJournalImportField, { confidence: string; low: boolean; evidence: string }> }[]
}
export interface BsJournalImportCopy {
  title: string; subtitle: string; deniedTitle: string; deniedBody: string; upgradeTitle: string; upgradeBody: string; plans: string; progress: string
  uploadTitle: string; uploadHint: string; chooseFile: string; downloadTemplate: string; templateHint: string; languageHint: string; formatHint: string; or: string
  pasteTitle: string; pasteHint: string; pastePlaceholder: string; reviewPaste: string; mappingTitle: string; changeFile: string; none: string; extractionDenied: string; selectColumn: string; fields: Record<BsJournalImportField, string>
  preview: string; validate: string; validating: string; results: string; validation: string; another: string; startOver: string; confirm: string; confirming: string
  review: string; rows: string; row: string; status: string; type: string; date: string; amount: string; issue: string; dash: string; previous: string; next: string; close: string
}
export interface BsJournalImportView {
  visible: boolean; dirty: boolean; pending: boolean; loading: boolean; denied: boolean; upgrade: boolean; plansTo: string | null
  phase: 'upload' | 'mapping' | 'validated' | 'results'; fileSummary: string; error: string; steps: { id: string; label: string }[]; headers: { value: string; label: string }[]; requiredFields: BsJournalImportField[]
  preview: { id: string; values: Record<string, string> }[]; validateDisabled: boolean; validating: boolean; batch: boolean; filename: string; status: string; metrics: { id: string; label: string; value: string }[]; usage: BsUsageItem | null; canConfirm: boolean; confirming: boolean
  reviewChoices: { value: string; label: string }[]; range: string; pageLabel: string; paginated: boolean; previousDisabled: boolean; nextDisabled: boolean
  rows: { id: string; rowNumber: number; status: string; type: string; date: string; amount: string; issue: string }[]
  extraction: { copy: BsDocumentExtractionCopy; view: BsDocumentExtractionView }
}
