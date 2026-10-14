import type { BsUsageItem } from '@building-suit/contracts'
export interface BsJournalDetailCopy {
  title: string; close: string; journal: string; account: string; debit: string; credit: string; totals: string
  tags: string; tagsHint: string; noTags: string; chooseTag: string; assignTag: string; removeTag: string; noTagOptions: string; tagError: string; retry: string
  attachments: string; upload: string; saving: string; noAttachments: string; delete: string; relationships: string
  reverseExplanation: string; reverseReason: string; reasonPlaceholder: string; cancel: string; reversing: string; reverseConfirm: string; reverseAction: string; openSource: string
  loading: string; failed: string
}
export interface BsJournalDetailForm { reason: string; selectedTag: string; confirming: boolean }
export interface BsJournalDetailView {
  visible: boolean; title: string; status: string; type: string; reference: string; dirty: boolean; pending: boolean; loading: boolean; loadError: string | null
  descriptions: { id: string; label: string; value: string }[]; source: { label: string; to: string } | null
  entries: { id: string; account: string; memo: string; debit: string; credit: string }[]; debit: string; credit: string
  tags: { visible: boolean; loading: boolean; failed: boolean; pending: boolean; assigned: { id: string; name: string }[]; choices: { value: string; label: string }[]; canManage: boolean; noOptions: boolean; error: string }
  attachments: { id: string; name: string }[]; canUpload: boolean; uploading: boolean; canDelete: boolean; storage: BsUsageItem | null
  relationships: { id: string; label: string; reference: string }[]; restriction: string; canReverse: boolean; reversing: boolean; error: string | null
}
