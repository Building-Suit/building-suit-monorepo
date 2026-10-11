import type { BsJournalDetailCopy, BsJournalDetailForm, BsJournalDetailView } from './journalDetailPresentation'
export type BsOperationalRecordKind = 'journals' | 'commitments' | 'recurring' | 'parties' | 'tags' | 'invitations'
export interface BsOperationalRecordRow {
  id: string; name: string; kind: string; date: string; status: string; amount: string; from: string; to: string; category: string
  schedule: string; nextRun: string; email: string; phone: string; color: string; role: string; expires: string; toJournal: string | null
  canSettle: boolean; canPostpone: boolean; canCancel: boolean; canPause: boolean; canResume: boolean
}
export interface BsCommitmentActionForm { amount: string; account: string; date: string }
export interface BsOperationalRecordsCopy {
  title: string; count: string; allJournals: string; create: string; empty: string; emptyHint: string; failed: string; retry: string
  name: string; kind: string; date: string; description: string; category: string; fromTo: string; status: string; amount: string; actions: string; schedule: string; nextRun: string; email: string; phone: string; created: string; role: string; expires: string
  settle: string; postpone: string; cancel: string; pause: string; resume: string; viewJournals: string; account: string; partialAmount: string; actionDate: string
}
export interface BsOperationalRecordsView {
  kind: BsOperationalRecordKind; journalDirectoryTo: string; canCreate: boolean; loading: boolean; failed: boolean; rows: BsOperationalRecordRow[]; pending: boolean; error: string | null
  guide: { title: string; body: string; steps: { id: string; title: string; body: string }[]; example: string; link: string; linkLabel: string } | null
  dialog: { visible: boolean; title: string; dirty: boolean; pending: boolean; error: string | null; submit: string; settling: boolean; accounts: { value: string; label: string }[] }
  journal: { copy: BsJournalDetailCopy; view: BsJournalDetailView }
}
export type BsOperationalRecordsJournalForm = BsJournalDetailForm
