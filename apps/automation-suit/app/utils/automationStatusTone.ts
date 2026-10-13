/** Product execution vocabulary supplied to the shared status presentation. */
export function automationStatusTone(value?: string | null): 'danger' | 'warning' | 'info' | 'success' | 'neutral' {
  const normalized = String(value || 'unknown').toLowerCase()
  if (['failed', 'fail', 'critical', 'cancelled'].includes(normalized)) return 'danger'
  if (['blocked', 'warning', 'not_run', 'stopped'].includes(normalized)) return 'warning'
  if (['running', 'in_progress', 'verification', 'open', 'planned', 'queued'].includes(normalized)) return 'info'
  if (['passed', 'pass', 'complete', 'finished', 'succeeded', 'merged', 'approved'].includes(normalized)) return 'success'
  return 'neutral'
}
