import type { HqFounderAccessPresentation } from '@building-suit/ui/types/hqLayoutPresentation'
import type { HqEmailConnectionCommand, HqEmailConnectionPresentation, HqEmailConnectionReadiness, HqEmailTestSnapshot } from '@building-suit/ui/types/hqEmailConnection'
import { parseEmailTest, parseEmailReadiness, emailTestApprovable } from '../utils/emailConnectionTest'

/** Manual founder actions only. No polling, sending, credentials or inferred consent. */
export function useHqEmailConnectionTest(getAccess: () => HqFounderAccessPresentation) {
  const pending = ref(false), message = ref('')
  const readiness = shallowRef<HqEmailConnectionReadiness | null>(null), test = shallowRef<HqEmailTestSnapshot | null>(null)
  let epoch = 0, disposed = false, controller: AbortController | null = null
  let prepareAttempt: { fingerprint: string; requestKey: string } | null = null
  let uncertainDecision = false
  const identity = () => JSON.stringify([getAccess().status, getAccess().user?.displayName, getAccess().user?.detailLabel])
  const presentation = computed<HqEmailConnectionPresentation>(() => ({ pending: pending.value, readiness: readiness.value,
    test: test.value, message: message.value, approvalAvailable: !uncertainDecision && emailTestApprovable(test.value, Date.now()) }))
  async function command(command: HqEmailConnectionCommand) {
    if (disposed || pending.value || getAccess().status !== 'founder' || getAccess().pending) return
    if (command.action === 'decide' && (uncertainDecision || !emailTestApprovable(test.value, Date.now())
      || command.id !== test.value?.id || command.digest !== test.value?.digest)) return
    if (command.action === 'prepare' && test.value && ['reserved','uncertain'].includes(test.value.state)) {
      message.value = 'Reconcile the existing test outcome before creating another test.'; return
    }
    const owner = identity(), generation = epoch
    pending.value = true; message.value = ''; controller = new AbortController()
    const current = () => !disposed && generation === epoch && owner === identity() && getAccess().status === 'founder'
    const options = { headers: { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' }, credentials: 'same-origin' as const,
      cache: 'no-store' as const, retry: 0, timeout: 15000, signal: controller.signal }
    try {
      if (command.action === 'refresh') {
        const r = parseEmailReadiness(await $fetch<unknown>('/api/hq/email-tests/readiness', options))
        if (!r) throw Error('invalid-readiness')
        if (!current()) return
        readiness.value = r
        const id = command.id ?? test.value?.id
        if (id) {
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw Error('invalid-id')
          const t = parseEmailTest(await $fetch<unknown>(`/api/hq/email-tests/${id}`, options))
          if (!t || t.id !== id) throw Error('invalid-test')
          if (!current()) return
          test.value = t; uncertainDecision = false
        }
        message.value = 'Latest recorded connection status loaded. No email was sent by this action.'
      } else if (command.action === 'prepare') {
        const fingerprint = JSON.stringify([command.recipient, command.subject, command.body])
        if (prepareAttempt && prepareAttempt.fingerprint !== fingerprint) {
          message.value = 'An earlier preview request is unconfirmed. Retry with the same recipient, subject and body before changing it.'; return
        }
        prepareAttempt ??= { fingerprint, requestKey: crypto.randomUUID() }
        const t = parseEmailTest(await $fetch<unknown>('/api/hq/email-tests', { ...options, method: 'POST',
          body: { recipient: command.recipient, subject: command.subject, body: command.body, requestKey: prepareAttempt.requestKey } }))
        if (!t || t.recipient !== command.recipient || t.subject !== command.subject || t.body !== command.body) throw Error('preview-mismatch')
        if (!current()) return
        test.value = t; prepareAttempt = null; uncertainDecision = false
        message.value = 'Preview prepared only. Review the exact message before approving.'
      } else {
        uncertainDecision = true
        const t = parseEmailTest(await $fetch<unknown>(`/api/hq/email-tests/${command.id}/decision`, { ...options, method: 'POST', body: { digest: command.digest, approve: command.approve } }))
        if (!t || t.id !== command.id || t.digest !== command.digest || t.state !== (command.approve ? 'approved' : 'revoked')) throw Error('decision-mismatch')
        if (!current()) return
        test.value = t; uncertainDecision = false
        message.value = command.approve ? 'Exact test approved and queued for the Oracle worker. Approval is not a send receipt.' : 'Test approval revoked.'
      }
    } catch {
      if (current()) message.value = command.action === 'prepare'
        ? 'Preview request unconfirmed. Retry the same exact inputs; the request identity is retained.'
        : 'Action unconfirmed. Refresh the existing test before another decision. Do not resend.'
    } finally { if (current()) { pending.value = false; controller = null } }
  }
  watch(identity, () => { epoch++; controller?.abort(); pending.value = false; readiness.value = null; test.value = null;
    prepareAttempt = null; uncertainDecision = false; message.value = '' })
  onScopeDispose(() => { disposed = true; epoch++; controller?.abort() })
  return { presentation, command }
}
