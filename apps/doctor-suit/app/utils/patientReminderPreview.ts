import { clinicalUuid, validClinicalSegments } from './clinical.ts'
import type { PatientPrescriptionPreview, PatientPrescriptionSource } from './patientPrescriptionPreview.ts'

export const reminderPreviewAlgorithm = 'doctor-reminder-preview-v1' as const
export type ReminderPreviewBlocker = 'invalid_input' | 'prescription_not_current' | 'as_needed_requires_review' | 'window_too_large' | 'event_limit' | 'missing_anchor' | 'anchor_mismatch' | 'unsupported_interval_basis' | 'dst_gap' | 'dst_fold' | 'renderer_unsupported' | 'unsupported_clock_precision'
export interface ReminderPreviewAnchor { segmentIndex: number; instant: string; basis: 'elapsed_utc' }
export interface ReminderPreviewEvent { id: string; source: PatientPrescriptionSource; segmentIndex: number; occurrenceUtc: string; localDay: string; localTime: string; timezone: string }
export interface ReminderPreviewPlan {
  algorithm: typeof reminderPreviewAlgorithm
  binding: string
  outcome: 'ready_for_review' | 'unsupported'
  blocker: ReminderPreviewBlocker | null
  events: readonly ReminderPreviewEvent[]
  syntheticOnly: true
  clinicalApproval: false
  qualifiedInterpretation: false
  externalNotifications: false
}
const minute = 60000, dayMs = 86400000
function date(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value }
function plan(binding: string, events: ReminderPreviewEvent[], blocker: ReminderPreviewBlocker | null): ReminderPreviewPlan {
  return Object.freeze({ algorithm: reminderPreviewAlgorithm, binding, outcome: blocker ? 'unsupported' : 'ready_for_review', blocker, events: Object.freeze(blocker ? [] : events), syntheticOnly: true, clinicalApproval: false, qualifiedInterpretation: false, externalNotifications: false })
}
/** Pure, unreviewed technical vectors. Never medical dosing, an approved schedule or a notification. */
export function patientReminderPreview(preview: PatientPrescriptionPreview, horizon: { fromDay: string; toDay: string }, anchors: readonly ReminderPreviewAnchor[], asOf: number): ReminderPreviewPlan {
  const blocked = (reason: ReminderPreviewBlocker) => plan(preview?.binding ?? '', [], reason)
  try {
    if (!preview || typeof preview.binding !== 'string' || !preview.binding || preview.syntheticOnly !== true || preview.clinicalApproval !== false || preview.professionalSignature !== false || preview.livePrescribing !== false || preview.externalNotifications !== false || !Number.isSafeInteger(preview.observedAt) || preview.observedAt < 0 || !Number.isSafeInteger(preview.validUntil) || !Number.isSafeInteger(asOf) || asOf < preview.observedAt || asOf >= preview.validUntil || ![preview.source?.releaseId, preview.source?.versionId, preview.source?.prescriptionId].every(clinicalUuid) || !Number.isSafeInteger(preview.source.revision) || preview.source.revision < 1 || !/^[0-9a-f]{64}$/.test(preview.source.snapshotSha256) || preview.prescription?.id !== preview.source.prescriptionId || !validClinicalSegments(preview.prescription.segments, preview.prescription.start_date, preview.prescription.end_date) || !date(horizon?.fromDay) || !date(horizon?.toDay) || horizon.toDay < horizon.fromDay || !Array.isArray(anchors)) return blocked('invalid_input')
    const firstDay = Date.parse(horizon.fromDay + 'T00:00:00Z'), lastDay = Date.parse(horizon.toDay + 'T00:00:00Z')
    if ((lastDay - firstDay) / dayMs >= 31) return blocked('window_too_large')
    if (preview.instructionKind !== 'scheduled' || preview.prescription.segments.some(s => s.kind === 'as_needed')) return blocked('as_needed_requires_review')
    if (!preview.currentVersionKnown || !['active', 'future'].includes(preview.state) || JSON.stringify(preview.reminderPreviewSource) !== JSON.stringify(preview.source)) return blocked('prescription_not_current')
    if (new Set(anchors.map(a => a.segmentIndex)).size !== anchors.length || anchors.some(a => !Number.isSafeInteger(a.segmentIndex) || a.segmentIndex < 0 || preview.prescription.segments[a.segmentIndex]?.kind !== 'interval' || Object.keys(a).sort().join(',') !== 'basis,instant,segmentIndex')) return blocked('invalid_input')
    const source = Object.freeze({ ...preview.source }), events: ReminderPreviewEvent[] = []
    const formatters = new Map<string, Intl.DateTimeFormat>(), localDays = new Map<string, Map<string, number[]>>()
    function local(at: number, timezone: string) {
      let formatter = formatters.get(timezone)
      if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, calendar: 'iso8601', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
        if (formatter.resolvedOptions().hourCycle !== 'h23') throw Error('REMINDER_RENDERER_UNSUPPORTED')
        formatters.set(timezone, formatter)
      }
      const parts = Object.fromEntries(formatter.formatToParts(at).map(part => [part.type, part.value]))
      if (!parts.second) throw Error('REMINDER_RENDERER_UNSUPPORTED')
      if (parts.second !== '00') throw Error('REMINDER_CLOCK_PRECISION_UNSUPPORTED')
      return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
    }
    function candidates(day: string, time: string, timezone: string) {
      const key = JSON.stringify([day, timezone])
      let map = localDays.get(key)
      if (!map) {
        map = new Map()
        const start = Date.parse(day + 'T00:00:00Z')
        // Exhaustive minute candidates across a bounded civil-offset window, not a guessed offset.
        for (let at = start - 26 * 3600000; at <= start + 50 * 3600000; at += minute) {
          const value = local(at, timezone)
          if (value.day === day) map.set(value.time, [...(map.get(value.time) ?? []), at])
        }
        localDays.set(key, map)
      }
      return map.get(time) ?? []
    }
    function emit(segmentIndex: number, at: number, timezone: string) {
      const value = local(at, timezone), occurrenceUtc = new Date(at).toISOString()
      const id = [reminderPreviewAlgorithm, source.releaseId, source.versionId, source.snapshotSha256, source.prescriptionId, segmentIndex, at].join(':')
      events.push(Object.freeze({ id, source, segmentIndex, occurrenceUtc, localDay: value.day, localTime: value.time, timezone }))
      return events.length <= 512
    }
    for (const [index, segment] of preview.prescription.segments.entries()) {
      const startDay = segment.start_date > horizon.fromDay ? segment.start_date : horizon.fromDay
      const endDay = segment.end_date < horizon.toDay ? segment.end_date : horizon.toDay
      if (endDay < startDay) continue
      if (segment.kind === 'weekdays') {
        for (let day = Date.parse(startDay + 'T00:00:00Z'); day <= Date.parse(endDay + 'T00:00:00Z'); day += dayMs) {
          const weekday = new Date(day).getUTCDay() || 7
          if (!segment.weekdays.includes(weekday)) continue
          const localDay = new Date(day).toISOString().slice(0, 10)
          for (const time of segment.times) {
            const instants = candidates(localDay, time, segment.timezone)
            if (instants.length !== 1) return blocked(instants.length ? 'dst_fold' : 'dst_gap')
            if (!emit(index, instants[0]!, segment.timezone)) return blocked('event_limit')
          }
        }
      } else if (segment.kind === 'interval') {
        const anchor = anchors.find(item => item.segmentIndex === index)
        if (!anchor) return blocked('missing_anchor')
        if (anchor.basis !== 'elapsed_utc') return blocked('unsupported_interval_basis')
        if (typeof anchor.instant !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?Z$/.test(anchor.instant)) return blocked('anchor_mismatch')
        const at = Date.parse(anchor.instant)
        if (!Number.isFinite(at) || at % minute !== 0) return blocked('anchor_mismatch')
        const first = local(at, segment.timezone)
        if (first.day !== segment.start_date || first.time !== segment.times[0]) return blocked('anchor_mismatch')
        const step = segment.interval_minutes! * minute
        const lower = Date.parse(startDay + 'T00:00:00Z') - 26 * 3600000, upper = Date.parse(endDay + 'T00:00:00Z') + 50 * 3600000
        let next = at + Math.max(0, Math.ceil((lower - at) / step)) * step
        for (; next <= upper; next += step) {
          const value = local(next, segment.timezone)
          if (value.day >= startDay && value.day <= endDay && !emit(index, next, segment.timezone)) return blocked('event_limit')
        }
      }
    }
    events.sort((a, b) => a.occurrenceUtc.localeCompare(b.occurrenceUtc) || a.segmentIndex - b.segmentIndex || a.id.localeCompare(b.id))
    return plan(preview.binding, events, null)
  } catch (error) { return blocked(error instanceof Error && error.message === 'REMINDER_RENDERER_UNSUPPORTED' ? 'renderer_unsupported' : error instanceof Error && error.message === 'REMINDER_CLOCK_PRECISION_UNSUPPORTED' ? 'unsupported_clock_precision' : 'invalid_input') }
}
/** Immutable preview diff only: withdrawal/unsupported/changed scope creates no replacement events. */
export function reconcileReminderPreviews(previous: ReminderPreviewPlan, next: ReminderPreviewPlan) {
  const sameScope = previous.binding === next.binding
  const wanted = new Set(sameScope ? next.events.map(event => event.id) : [])
  const existing = new Set(previous.events.map(event => event.id))
  return Object.freeze({ cancelIds: Object.freeze(previous.events.filter(event => !wanted.has(event.id)).map(event => event.id)), create: Object.freeze(sameScope ? next.events.filter(event => !existing.has(event.id)) : []), syntheticOnly: true, clinicalApproval: false, externalNotifications: false })
}
