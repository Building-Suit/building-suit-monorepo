import type { HqFounderAccessPresentation, HqStaffingCopy, HqStaffingDecision, HqStaffingPresentation } from '@building-suit/ui/types/hqLayoutPresentation'
import { parseHqStaffingSnapshot, type HqStaffingSnapshot } from '#shared/types/staffing'

export const hqStaffingCopy: HqStaffingCopy = {
  stop: 'Cancel task and hire workflow', stopConfirmation: 'Cancel the original task and stop this hire workflow? Existing planning, decisions and failed evidence are preserved. No completed task is revived.',
  limited: 'Only the most recent staffing records are shown; active proposals are included first.',
  title: 'Staffing proposals', empty: 'No staffing gaps need a proposal.', refresh: 'Refresh staffing', unavailable: 'Staffing status unavailable.',
  profile: 'Complete proposed profile', skills: 'Exact skills and source revisions', manager: 'Manager and department', reviewer: 'Independent trial reviewer',
  model: 'Model, effort and policy revision', trial: 'Required supervised trials and review', source: 'Original task', approve: 'Approve this hire plan', reject: 'Reject plan',
  resume: 'After real qualification and activation, continue this exact original task in a separate linked execution.', cancel: 'Cancel',
  confirmation: 'Record one decision for this exact profile, skills, model and review criteria? Publication remains blocked until an authorized canonical writer and verified conditional media writes are available. Approval does not claim the hire is completed.',
  conflict: 'The plan changed or access is unavailable. Refresh before deciding.',
  writerBoundary: 'Canonical staff publication is not configured. Reviewed plans can be approved and retained, but no employee will be published, qualified, activated or assigned resumed work until the writer setup gate is satisfied.',
}
const labels: Record<string, string> = {
  'not-required': 'No hire required', 'staffing-gap-resolved': 'Qualified staff are already available. The original blocked task has not been revived.',
  'planning-blocked': 'Preparation blocked', planning: 'Amaya and Steve are preparing the proposal', 'approval-required': 'Founder decision required',
  'publication-blocked': 'Approved · publication blocked', rejected: 'Rejected', canceled: 'Canceled', failed: 'Preparation failed',
  'staffing-planner-unavailable': 'Required current role or canonical inputs unavailable', 'staffing-planning': 'Actual planning and independent review are pending',
  'staffing-worker-protocol-required': 'Waiting for the compatible managed worker',
  'staffing-department-out-of-scope': 'This first version supports the six existing non-HR departments',
  'staffing-department-hire-already-pending': 'A hire proposal for this department is already in progress',
  'staffing-planning-capacity': 'Planning capacity unavailable', 'staffing-planning-context-capacity': 'Complete canonical inputs exceed the planning context limit',
  'staffing-source-task-unavailable': 'Original task is no longer eligible', 'staffing-plan-invalid': 'The proposal did not satisfy the exact plan contract',
  'staffing-binding-stale': 'The original task or canonical bindings changed. Reject the stale proposal and request an updated plan.',
  'staffing-profile-invalid': 'The proposed profile failed canonical identity or exact skill validation',
  'provider-quota': 'The existing model account has reached its quota', 'provider-auth': 'The existing model account needs sign-in',
  'provider-timeout': 'The bounded model execution timed out', 'provider-capacity': 'The model provider is temporarily unavailable',
  'worker-interrupted': 'Execution was interrupted; no hire was completed', 'review-repairs-exhausted': 'The two-correction review budget was exhausted',
  'staffing-plan-review-required': 'Same-artifact Amaya and Steve review is missing', 'staffing-founder-approval-required': 'Review the exact plan below',
  'canonical-writer-setup-required': 'Canonical writer setup and conditional media-write proof are required', 'staffing-plan-rejected': 'No hire is authorized',
  'staffing-planning-canceled': 'Planning was canceled', 'staffing-planning-failed': 'Planning failed; preserved history is not a completed hire',
}

/** Event-driven founder projection. Uncertain decisions retain their exact key. */
export function useHqStaffing(getAccess: () => HqFounderAccessPresentation) {
  const live = useHqLiveEvents()
  const snapshot = shallowRef<HqStaffingSnapshot | null>(null)
  const status = ref<HqStaffingPresentation['status']>('unavailable'), pending = ref(false), message = ref<string | undefined>()
  const attempts = new Map<string, string>()
  let epoch = 0, disposed = false, refreshing: Promise<void> | null = null, controller: AbortController | null = null, refreshQueued = false
  const identity = () => JSON.stringify([getAccess().status, getAccess().user?.displayName, getAccess().user?.detailLabel])
  const presentation = computed<HqStaffingPresentation>(() => ({ status: status.value, pending: pending.value, message: message.value, totalCount: snapshot.value?.totalCount,
    workflows: (snapshot.value?.workflows ?? []).map(row => ({ ...row, statusLabel: labels[row.status] ?? row.status,
      blockerLabel: labels[row.blocker] ?? 'Setup or current-source verification required' })) }))
  function clear(retainAttempts = false) { epoch++; controller?.abort(); controller = null; snapshot.value = null; status.value = 'unavailable'; pending.value = false; message.value = undefined; if (!retainAttempts) attempts.clear() }
  let scheduledRefresh: Promise<void> | null = null
  function refresh(): Promise<void> {
    // Both live topics and startup hooks can request the same snapshot in one
    // turn. Share only work not dispatched yet; an event after dispatch still
    // marks the active read dirty and gets the existing fresh follow-up.
    if (scheduledRefresh) return scheduledRefresh
    scheduledRefresh = Promise.resolve().then(() => {
      scheduledRefresh = null
      return runRefresh()
    })
    return scheduledRefresh
  }
  async function runRefresh() {
    if (disposed || getAccess().status !== 'founder' || getAccess().pending || pending.value) return
    if (refreshing) { refreshQueued = true; return refreshing }
    const generation = epoch, owner = identity()
    controller = new AbortController()
    if (!snapshot.value) status.value = 'loading'
    refreshing = (async () => {
      try {
        const value = parseHqStaffingSnapshot(await $fetch<unknown>('/api/hq/staffing', { headers: { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' },
          cache: 'no-store', retry: 0, timeout: 45000, signal: controller?.signal }))
        if (disposed || generation !== epoch || owner !== identity()) return
        if (!value) throw Error('staffing-unavailable')
        snapshot.value = value; status.value = 'ready'; message.value = undefined
      }
      catch { if (!disposed && generation === epoch && owner === identity()) { status.value = 'unavailable'; snapshot.value = null; message.value = hqStaffingCopy.unavailable } }
      finally {
        refreshing = null
        if (!disposed && getAccess().status === 'founder' && (refreshQueued || generation !== epoch)) {
          refreshQueued = false; void refresh()
        }
      }
    })()
    await refreshing
  }
  async function decide(command: HqStaffingDecision) {
    if (disposed || getAccess().status !== 'founder' || getAccess().pending || pending.value || status.value !== 'ready') return
    const row = snapshot.value?.workflows.find(entry => entry.planId === command.planId && entry.digest === command.digest && entry.status === 'approval-required')
    if (!row?.plan || command.decision === 'approved' && row.blocker !== 'staffing-founder-approval-required' || command.resumeOriginal && !row.plan.resumeOriginal) return
    const key = JSON.stringify(command), generation = epoch, owner = identity()
    const requestKey = attempts.get(key) ?? crypto.randomUUID(); attempts.set(key, requestKey)
    pending.value = true; message.value = undefined
    try {
      const value = parseHqStaffingSnapshot(await $fetch<unknown>('/api/hq/staffing', { method: 'POST', headers: { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' },
        body: { ...command, requestKey }, cache: 'no-store', retry: 0, timeout: 45000 }))
      if (disposed || generation !== epoch || owner !== identity()) return
      if (!value) throw Error('staffing-unconfirmed')
      snapshot.value = value; attempts.delete(key)
    }
    catch { if (!disposed && generation === epoch && owner === identity()) message.value = 'Decision outcome unconfirmed. Refresh, or retry the same decision; HQ checks the immutable plan and request key.' }
    finally { if (!disposed && generation === epoch) pending.value = false }
  }
  async function cancelStaffing(sourceTaskId: string) {
    if (disposed || getAccess().status !== 'founder' || getAccess().pending || pending.value
      || !snapshot.value?.workflows.some(row => row.sourceTaskId === sourceTaskId && !['canceled','rejected'].includes(row.status))) return
    const generation = epoch, owner = identity()
    pending.value = true; message.value = undefined
    try {
      await $fetch(`/api/hq/tasks/${encodeURIComponent(sourceTaskId)}/cancel`, { method: 'POST',
        headers: { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' }, cache: 'no-store', retry: 0, timeout: 45000 })
    }
    catch { if (!disposed && generation === epoch && owner === identity()) message.value = 'Cancellation is unconfirmed. Refresh or retry the same cancellation.' }
    finally {
      if (!disposed && generation === epoch && owner === identity()) { pending.value = false; await refresh() }
    }
  }
  live.subscribe('agents', refresh, reason => clear(reason === 'offline'))
  live.subscribe('company', refresh, reason => clear(reason === 'offline'))
  watch(identity, () => { clear(); if (getAccess().status === 'founder') void refresh() }, { immediate: true, flush: 'sync' })
  onMounted(() => { void refresh() })
  onScopeDispose(() => { disposed = true; clear() })
  return { staffing: presentation, staffingCopy: hqStaffingCopy, refreshStaffing: refresh, decideStaffing: decide, cancelStaffing }
}
