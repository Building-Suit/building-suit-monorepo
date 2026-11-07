import type { HqAgentRecord } from '#shared/types/agents'
import type { HqAgentPresentation } from '@building-suit/ui/types/hqAgentsPresentation'

const FRESHNESS_MS = 150_000
const CLOCK_SKEW_MS = 300_000

/** A host connection never substitutes for an employee's own observation. */
export function hqObservationFresh(lastSeenAt: string | null, now: number): boolean {
  const seen = lastSeenAt ? Date.parse(lastSeenAt) : NaN
  return Number.isFinite(now) && Number.isFinite(seen) && seen <= now + CLOCK_SKEW_MS && seen + FRESHNESS_MS > now
}

export function hqObservedActivity(record: Pick<HqAgentRecord, 'status' | 'lastSeenAt'>, runtimeOnline: boolean, now: number): HqAgentPresentation['activity'] {
  if (!runtimeOnline || !hqObservationFresh(record.lastSeenAt, now)) return 'offline'
  if (record.status === 'blocked') return 'unknown'
  return record.status === 'working' ? 'working' : record.status === 'idle' ? 'idle' : 'offline'
}

/** A configured character can be displayed without claiming an active employee. */
export function hqCosmeticIdle(configured: boolean, activity: HqAgentPresentation['activity'], runtimeOnline: boolean): boolean {
  return configured && runtimeOnline && (activity === 'offline' || activity === 'unknown')
}
