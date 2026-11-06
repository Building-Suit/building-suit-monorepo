export interface BrainNoteSummary {
  id: string
  title: string
  /** Path within the authorized cloud Brain folder. */
  path: string
  modifiedAt: string
  /** Google Drive's source version, with its content checksum when available. */
  version: string
}

export interface BrainIndex {
  status: 'connected' | 'unavailable'
  source: 'google-drive'
  reason?: 'not-configured' | 'authorization-required' | 'cloud-unavailable'
  /** When this server completed the cloud metadata read. */
  observedAt: string
  notes: BrainNoteSummary[]
  count: number
  partial: boolean
}

export interface BrainNote extends BrainNoteSummary {
  content: string
}
