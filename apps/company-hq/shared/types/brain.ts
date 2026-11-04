export interface BrainNoteSummary {
  id: string
  title: string
  /** Path within the authorized Brain folder, never an absolute host path. */
  path: string
  modifiedAt: string
}

export interface BrainIndex {
  status: 'connected' | 'unavailable'
  source: 'local-mirror'
  /** When this server read the local mirror; this is not a cloud sync timestamp. */
  observedAt: string
  notes: BrainNoteSummary[]
  count: number
  partial: boolean
}

export interface BrainNote extends BrainNoteSummary {
  content: string
}
