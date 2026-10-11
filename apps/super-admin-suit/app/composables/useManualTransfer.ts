import { emptyTransfer, parseTransfer, transferState, transferCommand, confirmTransferCommand } from '../utils/manual-transfer'
import type { TransferRequest } from '../utils/manual-transfer'

export function useManualTransfer(binding: () => string | undefined, active: () => boolean) {
  const { t } = useI18n()
  const fetch = useRequestFetch()
  const configuration = ref<ReturnType<typeof parseTransfer>>(null)
  const draft = ref(emptyTransfer())
  const reason = ref('')
  const status = ref('loading')
  const command = shallowRef<TransferRequest | null>(null)
  const action = useRecordAction(() => ({ draft: draft.value, reason: reason.value }))
  let generation = 0
  async function load() {
    const current = ++generation
    configuration.value = null
    status.value = 'loading'
    if (!binding() || !active()) return
    try {
      const result = await fetch<{ data: { configuration: unknown } }>('/api/adapters/shop', { method: 'POST', body: {
        bindingId: binding(), operation: 'shop.billing.query', requestId: crypto.randomUUID(), correlationId: crypto.randomUUID(), reason: null, payload: { resource: 'manual-transfer' },
      } })
      if (current !== generation) return
      configuration.value = parseTransfer(result.data.configuration)
      status.value = transferState(configuration.value)
    } catch (cause) {
      if (current !== generation) return
      const code = (cause as { statusCode?: number }).statusCode
      status.value = code === 401 || code === 403 ? 'denied' : 'error'
    }
  }
  function edit() {
    draft.value = configuration.value ? structuredClone(toRaw(configuration.value)) : emptyTransfer()
    reason.value = ''
    command.value = null
    action.edit()
  }
  async function save() {
    const current = generation
    await action.run(async () => {
      command.value ||= transferCommand(binding()!, draft.value, reason.value, () => crypto.randomUUID())
      const saved = await confirmTransferCommand(command.value, request => fetch<{ data: { configuration: unknown }; targetAuditId?: string }>('/api/adapters/shop', { method: 'POST', body: request }))
      if (current !== generation || !active()) return
      configuration.value = saved
      status.value = transferState(configuration.value)
      command.value = null
    }, () => t('transfer.saveError'))
  }
  watch([binding, active], () => {
    ++generation
    configuration.value = null
    command.value = null
    draft.value = emptyTransfer()
    reason.value = ''
    action.complete()
    if (active()) void load()
  }, { immediate: true })
  onScopeDispose(() => { ++generation; configuration.value = null; command.value = null })
  return { configuration, draft, reason, status, command, action, load, edit, save }
}
