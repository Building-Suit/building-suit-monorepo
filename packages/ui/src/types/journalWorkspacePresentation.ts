import type { BsJournalDetailCopy, BsJournalDetailView } from './journalDetailPresentation'
import type { BsJournalImportCopy, BsJournalImportView } from './journalImportPresentation'
export interface BsJournalWorkspaceFilters { search: string; type: string; status: string; source: string; from: string; to: string; account: string; tag: string; category: string; min: string; max: string; savedView: string; savedName: string; density: 'compact' | 'comfortable'; expanded: boolean }
export interface BsJournalWorkspaceCopy {
  title: string; subtitle: string; context: string; import: string; create: string; type: string; status: string; source: string; search: string; searchPlaceholder: string; from: string; to: string; account: string; tag: string; category: string; min: string; max: string; moreFilters: string; clearFilters: string; count: string; savedViews: string; viewName: string; saveView: string; removeView: string; savedError: string; tagError: string; retry: string
  denied: string; failed: string; retryHint: string; empty: string; emptyHint: string; noMatch: string; noMatchHint: string; noMatchAction: string; scroll: string; density: string; compact: string; comfortable: string; reference: string; date: string; description: string; debit: string; credit: string; previous: string; next: string
}
export interface BsJournalWorkspaceRow { id: string; reference: string; date: string; description: string; source: string; type: string; status: string; debit: string; credit: string; tags: string[] }
export interface BsJournalWorkspaceChoices { quickTypes: { value: string; label: string }[]; types: { value: string; label: string }[]; statuses: { value: string; label: string }[]; sources: { value: string; label: string }[]; accounts: { value: string; label: string }[]; tags: { value: string; label: string }[]; categories: { value: string; label: string }[]; savedViews: { value: string; label: string }[] }
export interface BsJournalWorkspaceView {
  context: { label: string; value: string }[]; canImport: boolean; canCreate: boolean; canRead: boolean; canReadTags: boolean; ready: boolean; preferenceReady: boolean; tagsFailed: boolean; savedPending: boolean; saving: boolean; savedFailed: boolean; hasFilters: boolean; loading: boolean; failed: boolean; validation: string; empty: boolean; noMatch: boolean; rows: BsJournalWorkspaceRow[]; showing: string; pageLabel: string; previousDisabled: boolean; nextDisabled: boolean
  sorts: { key: string; direction: 'none' | 'ascending' | 'descending' }[]
  journal: { copy: BsJournalDetailCopy; view: BsJournalDetailView }; import: { copy: BsJournalImportCopy; view: BsJournalImportView }
}
