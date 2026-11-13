import type { BsAssistantChatMessage, BsAssistantChatView, BsShellAssistantChat } from '@building-suit/ui/types/assistantChatPresentation'
import type { ShopHqChatAccess, ShopHqChatHistory, ShopHqChatJob, ShopHqChatMessage } from '#shared/shopHqChat'
import { shopAssistantCopy } from '~/utils/shopAssistantCopy'
import { shopHqAssistantCopy } from '~/utils/shopHqAssistantCopy'

const maximumLength = 2_000
const encode = new TextEncoder()
const historyRetryMs = 5_000
const fallbackForMs = 425_000

export function useShopHqAssistant() {
  const config = useRuntimeConfig()
  const client = useSupabaseClient()
  const user = useSupabaseUser()
  const queries = useShopQueryCache()
  const { locale } = useI18n()
  const { current, currentId, currentLocation, currentLocationId, currentMembership, isOwner, loading } = useShop()
  const enabled = computed(() => config.public.shopAssistantMode === 'hq' && String(config.public.shopAssistantEnabled) === 'true')
  const isArabic = computed(() => locale.value === 'ar')
  const copy = computed(() => shopAssistantCopy(isArabic.value))
  const labels = computed(() => shopHqAssistantCopy(isArabic.value))
  const draft = ref('')
  const openRequest = ref(0)
  const opened = ref(false)
  const access = shallowRef<ShopHqChatAccess>()
  const entries = shallowRef<ShopHqChatMessage[]>([])
  const activeJobs = shallowRef<ShopHqChatJob[]>([])
  const hasMore = ref(false)
  const historyLoading = ref(false)
  const loadingEarlier = ref(false)
  const historyError = ref(false)
  const accessError = ref(false)
  const pending = ref<BsAssistantChatView['pending']>(null)
  const sendError = ref<keyof ReturnType<typeof shopAssistantCopy>['error'] | null>(null)
  const waiting = computed(() => activeJobs.value.some(job => job.state !== 'completed'))
  const scope = computed(() => {
    const actor = user.value?.id, shopId = currentId.value, locationId = currentLocationId.value
    if (!enabled.value || !isOwner.value || loading.value || !actor || !shopId || !locationId) return null
    return { actor, shopId, locationId }
  })
  type Channel = ReturnType<typeof client.channel>
  type Binding = NonNullable<typeof scope.value> & {
    controller: AbortController
    channel?: Channel
    ready: boolean
    dirty: boolean
    reading?: Promise<void>
    checkingAccess?: Promise<void>
    timer?: ReturnType<typeof setTimeout>
    retryUntil: number
  }
  let binding: Binding | undefined
  let releasingChannel: Promise<unknown> = Promise.resolve()
  let retry: { message: string; requestId: string } | undefined

  const messages = computed<BsAssistantChatMessage[]>(() => entries.value.map(entry => {
    const id = entry.sequence
    if (entry.kind === 'message') return { id, role: entry.role, text: entry.text }
    if (entry.kind === 'receipt') return {
      id, role: 'receipt', text: labels.value.saleRecorded,
      link: { to: `/sales/${entry.link.saleId}/receipt?origin=assistant`, label: labels.value.openReceipt },
    }
    if (entry.kind === 'status') return { id, role: 'assistant', text: labels.value.failed }
    const outcome = entry.outcome
    const amount = 'total' in outcome && outcome.total !== undefined && outcome.currency
      ? new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: outcome.currency }).format(outcome.total)
      : ''
    return {
      id, role: 'assistant',
      text: outcome.kind === 'amount_mismatch' ? labels.value.amountMismatch(amount)
        : outcome.kind === 'payment_missing' && amount ? labels.value.paymentForTotal(amount)
          : labels.value[outcome.kind],
    }
  }))

  const canSend = computed(() => Boolean(access.value?.enabled && access.value.queueAvailable && !accessError.value))
  const assistant = computed<BsShellAssistantChat | undefined>(() => {
    if (!enabled.value || !user.value || !isOwner.value) return
    const label = labels.value
    return {
      copy: {
        ...copy.value.chat, title: label.title, assistant: isArabic.value ? label.title : access.value?.agentName ?? label.title,
        privacy: label.introduction, emptyDescription: label.emptyDescription,
        loadEarlier: label.loadEarlier, loadingEarlier: label.loadingEarlier,
      },
      view: {
        state: loading.value ? 'loading' : scope.value ? 'ready' : 'noLocation',
        context: [
          { label: copy.value.fields.shop, value: current.value?.name ?? '' },
          { label: copy.value.fields.location, value: currentLocation.value?.name ?? '' },
        ],
        messages: messages.value,
        proposal: null,
        delegation: access.value ? {
          enabled: access.value.enabled, title: label.authorizeTitle, explanation: label.authorization,
          enable: label.enable, disable: label.disable,
          policies: [{ to: '/privacy', label: label.privacy }, { to: '/terms', label: label.terms }],
        } : undefined,
        canSend: canSend.value && !waiting.value,
        showComposer: Boolean(access.value?.enabled && access.value.queueAvailable),
        notice: access.value && !access.value.queueAvailable ? label.queueUnavailable : undefined,
        hasMore: hasMore.value,
        loadingEarlier: loadingEarlier.value,
        historyLoading: historyLoading.value,
        pendingJobs: activeJobs.value.map(job => ({ id: job.jobId, label: job.state === 'queued'
          ? label.requestQueued : job.state === 'working' ? label.requestWorking : label.requestReviewing })),
        pending: pending.value,
        error: accessError.value ? label.accessError : historyError.value ? label.historyError
          : sendError.value ? copy.value.error[sendError.value] : null,
      },
      maximumLength, launcherLabel: label.launcher, closeLabel: label.close, openRequest: openRequest.value,
    }
  })

  function apiScope(active: Binding) {
    return { shopId: active.shopId, locationId: active.locationId }
  }

  function readHistory(active: Binding, beforeSequence?: number) {
    return $fetch<ShopHqChatHistory>('/api/assistant/hq/history', {
      method: 'POST', body: { ...apiScope(active), beforeSequence }, signal: active.controller.signal, timeout: 10_000,
    })
  }

  function merge(entriesToAdd: ShopHqChatMessage[]) {
    const known = new Map(entries.value.map(entry => [entry.sequence, entry]))
    for (const entry of entriesToAdd) known.set(entry.sequence, entry)
    entries.value = [...known.values()].sort((a, b) => a.sequence - b.sequence)
  }

  function checkAccess(active: Binding) {
    active.checkingAccess ??= (async () => {
      try {
        const result = await $fetch<ShopHqChatAccess>('/api/assistant/hq/access', {
          method: 'POST', body: apiScope(active), signal: active.controller.signal, timeout: 10_000,
        })
        if (binding === active && pending.value !== 'access') {
          access.value = result
          accessError.value = false
        }
      } catch (error) {
        if (binding === active && pending.value !== 'access') {
          accessError.value = true
          clearOnDenied(error)
        }
      }
    })().finally(() => { active.checkingAccess = undefined })
    return active.checkingAccess
  }

  function clearOnDenied(error: unknown) {
    const status = (error as { statusCode?: number })?.statusCode
    if (status !== 401 && status !== 403) return
    unbind()
    clearHistory()
    accessError.value = true
  }

  function scheduleCatchUp(active: Binding) {
    clearTimeout(active.timer)
    if (binding !== active || !opened.value || Date.now() >= active.retryUntil) return
    if (activeJobs.value.length && (!active.ready || historyError.value)) {
      active.timer = setTimeout(() => { void refresh(active) }, historyRetryMs)
    }
  }

  function refresh(active: Binding) {
    active.dirty = true
    active.reading ??= (async () => {
      do {
        active.dirty = false
        try {
          const latest = await readHistory(active)
          if (binding !== active) return
          const first = latest.messages[0]?.sequence
          const lastKnown = entries.value.at(-1)?.sequence
          // A full latest page without overlap may have skipped intervening messages.
          if (first === undefined || (lastKnown !== undefined && first > lastKnown)) {
            entries.value = latest.messages
            hasMore.value = latest.hasMore
          } else {
            if (!entries.value.length) hasMore.value = latest.hasMore
            merge(latest.messages)
          }
          activeJobs.value = latest.activeJobs
          historyError.value = false
        } catch (error) {
          if (binding === active) {
            historyError.value = true
            clearOnDenied(error)
          }
        }
      } while (active.dirty && binding === active)
    })().finally(() => {
      active.reading = undefined
      if (binding !== active) return
      historyLoading.value = false
      scheduleCatchUp(active)
    })
    return active.reading
  }

  async function loadEarlier() {
    const active = binding
    const before = entries.value[0]?.sequence
    if (!active || !before || !hasMore.value || loadingEarlier.value) return
    loadingEarlier.value = true
    try {
      const previous = await readHistory(active, before)
      if (binding !== active) return
      if (entries.value[0]?.sequence !== before) return
      merge(previous.messages)
      hasMore.value = previous.hasMore
      historyError.value = false
    } catch (error) {
      if (binding === active) {
        historyError.value = true
        clearOnDenied(error)
      }
    } finally {
      if (binding === active) loadingEarlier.value = false
    }
  }

  function bind() {
    if (!import.meta.client || !opened.value || binding || !scope.value) return
    const active: Binding = {
      ...scope.value, controller: new AbortController(), ready: false, dirty: false, retryUntil: Date.now() + fallbackForMs,
    }
    binding = active
    accessError.value = false
    historyLoading.value = true
    void checkAccess(active)
    void refresh(active)
    void releasingChannel.then(() => {
      if (binding !== active) return
      const topic = `shop-hq-assistant-chat:${active.actor}:${active.shopId}:${active.locationId}`
      const channel = client.channel(topic, { config: { private: true } })
      active.channel = channel
      channel.on('broadcast', { event: 'chat' }, () => {
        if (binding !== active) return
        void refresh(active)
      }).subscribe(status => {
        if (binding !== active) return
        active.ready = status === 'SUBSCRIBED'
        if (active.ready) {
          void checkAccess(active)
          void refresh(active)
        }
        scheduleCatchUp(active)
      })
    }).catch(() => {
      if (binding === active) scheduleCatchUp(active)
    })
  }

  function unbind() {
    const active = binding
    if (!active) return
    binding = undefined
    active.controller.abort()
    clearTimeout(active.timer)
    if (active.channel) releasingChannel = client.removeChannel(active.channel).catch(() => {})
    historyLoading.value = false
    loadingEarlier.value = false
    pending.value = null
  }

  function clearHistory() {
    access.value = undefined
    entries.value = []
    activeJobs.value = []
    hasMore.value = false
    historyError.value = false
    accessError.value = false
    sendError.value = null
    retry = undefined
    draft.value = ''
  }

  function open() {
    opened.value = true
    catchUp()
  }

  function close() {
    opened.value = false
    clearTimeout(binding?.timer)
  }

  async function authorize(allow: boolean) {
    const active = binding
    if (!active || pending.value) return
    pending.value = 'access'
    accessError.value = false
    sendError.value = null
    try {
      await active.checkingAccess
      if (binding !== active) return
      const result = await $fetch<ShopHqChatAccess>('/api/assistant/hq/access', {
        method: 'POST', body: { ...apiScope(active), enabled: allow }, signal: active.controller.signal, timeout: 10_000,
      })
      if (binding !== active) return
      access.value = result
      await refresh(active)
    } catch (error) {
      if (binding === active) {
        accessError.value = true
        clearOnDenied(error)
      }
    } finally {
      if (binding === active) {
        pending.value = null
      }
    }
  }

  async function send() {
    const active = binding
    const message = draft.value.trim()
    if (!active || !canSend.value || waiting.value || pending.value || !message) return
    if (encode.encode(message).length > maximumLength) {
      sendError.value = 'tooLong'
      return
    }
    if (retry?.message !== message) retry = { message, requestId: crypto.randomUUID() }
    pending.value = 'send'
    sendError.value = null
    try {
      const result = await $fetch<{ jobId: string }>('/api/assistant/hq/requests', {
        method: 'POST', body: { ...apiScope(active), ...retry }, signal: active.controller.signal, timeout: 10_000,
      })
      if (binding !== active) return
      active.retryUntil = Date.now() + fallbackForMs
      if (draft.value.trim() === message) draft.value = ''
      retry = undefined
      if (!activeJobs.value.some(job => job.jobId === result.jobId)) {
        activeJobs.value = [...activeJobs.value, { jobId: result.jobId, state: 'queued', reviewPending: false }]
      }
      await refresh(active)
    } catch (error) {
      if (binding !== active) return
      const status = (error as { statusCode?: number })?.statusCode
      sendError.value = status === 429 ? 'busy' : status === 401 || status === 403 ? 'access'
        : status === 503 ? 'unavailable' : 'message'
      if (status === 403 || status === 503) void checkAccess(active)
    } finally {
      if (binding === active) {
        pending.value = null
      }
    }
  }

  function catchUp() {
    if (!opened.value) return
    if (!binding) return bind()
    void checkAccess(binding)
    void refresh(binding)
  }

  watch([() => user.value?.id, currentId, currentLocationId, () => currentMembership.value?.id,
    () => queries.scope.revision, isOwner, enabled, loading], ([actor], [previousActor]) => {
    if (actor !== previousActor || !enabled.value || !isOwner.value) {
      opened.value = false
      openRequest.value = 0
    }
    unbind()
    clearHistory()
    bind()
  }, { flush: 'sync' })

  onMounted(() => {
    window.addEventListener('online', catchUp)
    window.addEventListener('focus', catchUp)
  })
  onScopeDispose(() => {
    if (import.meta.client) {
      window.removeEventListener('online', catchUp)
      window.removeEventListener('focus', catchUp)
    }
    unbind()
    clearHistory()
  })

  return { assistant, draft, open, close, authorize, send, loadEarlier, requestOpen: () => { openRequest.value++ } }
}
