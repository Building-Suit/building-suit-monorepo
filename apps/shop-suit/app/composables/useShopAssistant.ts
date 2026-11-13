import type { BsAssistantChatLink, BsAssistantChatMessage, BsAssistantChatView } from '@building-suit/ui/types/assistantChatPresentation'
import { shopAssistantCopy } from '~/utils/shopAssistantCopy'
import { shopHqAssistantCopy } from '~/utils/shopHqAssistantCopy'

const maximumLength = 2000
const maximumHistory = 12
const destinations = { products: '/products', inventory: '/inventory', reports: '/reports', expenses: '/expenses' } as const

type Destination = keyof typeof destinations
type ErrorCode = keyof ReturnType<typeof shopAssistantCopy>['error']
type Message = BsAssistantChatMessage & { destination?: Destination }

interface ExpenseProposal {
  token: string
  title: string
  amount: number
  currency: string
  date: string
  category: string
  location: string
}

interface ChatReply {
  text: string
  proposal?: ExpenseProposal
  link?: { destination: Destination }
}

function errorFor(error: unknown, fallback: 'message' | 'confirm'): ErrorCode {
  const response = error as { statusCode?: number; data?: { data?: { code?: string } } } | null
  if (response?.statusCode === 409 && response.data?.data?.code === 'ASSISTANT_PROPOSAL_EXPIRED') return 'expired'
  if (response?.statusCode === 409 && response.data?.data?.code === 'ASSISTANT_PROPOSAL_CHANGED') return 'changed'
  if (response?.statusCode === 401 || response?.statusCode === 403) return 'access'
  if (response?.statusCode === 429) return 'busy'
  if (fallback === 'confirm') return 'confirm'
  if ([404, 502, 503].includes(response?.statusCode ?? 0)) return 'unavailable'
  return fallback
}

export function useShopAssistant() {
  const user = useSupabaseUser()
  const { current, currentId, currentLocation, currentLocationId, currentMembership, isOwner, loading } = useShop()
  const config = useRuntimeConfig()
  const queries = useShopQueryCache()
  const { locale } = useI18n()
  const enabled = computed(() => String(config.public.shopAssistantEnabled) === 'true')
  const isArabic = computed(() => locale.value === 'ar')
  const copy = computed(() => shopAssistantCopy(isArabic.value))
  const hqCopy = computed(() => shopHqAssistantCopy(isArabic.value))
  const managed = computed(() => config.public.shopAssistantMode === 'hq')
  const hq = useShopHqAssistant()
  const delegation = ref<{ enabled: boolean; agentName: string } | null>(null)
  const accessError = ref(false)
  const chatCopy = computed(() => {
    if (!managed.value) return copy.value.chat
    const { title, introduction, emptyDescription } = hqCopy.value
    return { ...copy.value.chat, title, assistant: isArabic.value ? title : delegation.value?.agentName ?? title, privacy: introduction, emptyDescription }
  })
  const accessScope = computed(() => {
    if (!managed.value || !enabled.value || !isOwner.value || loading.value
      || !currentId.value || !currentLocationId.value) return null
    return { shopId: currentId.value, locationId: currentLocationId.value }
  })

  const messages = ref<Message[]>([])
  const messageIds = new Map<string, number>()
  function idFor(key: string) {
    const existing = messageIds.get(key)
    if (existing !== undefined) return existing
    const id = ++nextMessageId
    messageIds.set(key, id)
    return id
  }
  const managedMessages = computed<Message[]>(() => hq.turns.value.flatMap(turn => {
    if (turn.state === 'revoked') return []
    const messages: Message[] = turn.ownerMessage
      ? [{ id: idFor(turn.jobId), role: 'user', text: turn.ownerMessage }]
      : []
    for (const update of turn.updates) {
      const id = idFor(`${turn.jobId}:${update.sequence}`)
      if (update.kind === 'reply') messages.push({ id, role: 'assistant', text: update.text })
      else if (update.kind === 'receipt') messages.push({
        id, role: 'receipt', text: hqCopy.value.saleRecorded,
        link: { to: `/sales/${update.invoiceId}/receipt?origin=assistant`, label: hqCopy.value.openReceipt },
      })
      else {
        const outcome = update.outcome
        const amount = 'total' in outcome && outcome.total !== undefined && outcome.currency
          ? new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: outcome.currency }).format(outcome.total)
          : ''
        const text = outcome.kind === 'amount_mismatch' ? hqCopy.value.amountMismatch(amount)
          : outcome.kind === 'payment_missing' && amount ? hqCopy.value.paymentForTotal(amount)
          : hqCopy.value[outcome.kind]
        messages.push({ id, role: 'assistant', text })
      }
    }
    if ((turn.state === 'expired' || turn.state === 'failed') && !turn.updates.length) {
      messages.push({ id: idFor(`${turn.jobId}:failure`), role: 'assistant', text: hqCopy.value.failed })
    }
    return messages
  }))
  const proposal = ref<ExpenseProposal | null>(null)
  const draft = ref('')
  const pending = ref<BsAssistantChatView['pending']>(null)
  const error = ref<ErrorCode | null>(null)
  let controller: AbortController | null = null
  let nextMessageId = 0

  const state = computed<BsAssistantChatView['state']>(() => {
    if (loading.value) return 'loading'
    if (!isOwner.value) return 'denied'
    if (!enabled.value) return 'unavailable'
    if (!currentId.value || !currentLocationId.value) return 'noLocation'
    if (managed.value && !delegation.value && !accessError.value) return 'loading'
    return 'ready'
  })

  function link(destination?: Destination): BsAssistantChatLink | undefined {
    if (!destination || !Object.hasOwn(destinations, destination)) return
    return { to: destinations[destination], label: copy.value.links[destination] }
  }

  const view = computed<BsAssistantChatView>(() => {
    const activeProposal = proposal.value
    const labels = copy.value.fields
    const formatLocale = isArabic.value ? 'ar-EG' : 'en-EG'
    return {
      state: state.value,
      context: state.value === 'ready' ? [
        { label: labels.shop, value: current.value?.name ?? '' },
        { label: labels.location, value: currentLocation.value?.name ?? '' },
      ] : [],
      messages: managed.value ? managedMessages.value : messages.value.map(({ destination, ...message }) => ({ ...message, link: link(destination) })),
      proposal: activeProposal ? {
        title: activeProposal.title,
        fields: [
          { label: labels.amount, value: new Intl.NumberFormat(formatLocale, { style: 'currency', currency: activeProposal.currency, maximumFractionDigits: 20 }).format(activeProposal.amount) },
          { label: labels.category, value: activeProposal.category },
          { label: labels.date, value: new Intl.DateTimeFormat(formatLocale, { dateStyle: 'medium', timeZone: 'Africa/Cairo' }).format(new Date(activeProposal.date)) },
          { label: labels.location, value: activeProposal.location },
        ],
      } : null,
      ...(managed.value && {
        delegation: {
          enabled: delegation.value?.enabled ?? false,
          title: hqCopy.value.authorizeTitle,
          explanation: hqCopy.value.authorization,
          enable: hqCopy.value.enable,
          disable: hqCopy.value.disable,
          policies: [{ to: '/privacy', label: hqCopy.value.privacy }, { to: '/terms', label: hqCopy.value.terms }],
        },
      }),
      pending: pending.value ?? (managed.value && hq.waiting.value ? 'send' : null),
      error: accessError.value ? hqCopy.value.accessError
          : error.value ? copy.value.error[error.value] : null,
    }
  })

  function reset() {
    controller?.abort()
    controller = null
    messages.value = []
    proposal.value = null
    draft.value = ''
    pending.value = null
    error.value = null
    messageIds.clear()
    hq.reset()
  }

  async function refreshAccess() {
    const scope = accessScope.value
    delegation.value = null
    accessError.value = false
    if (!scope) return
    const request = begin('access')
    try {
      const next = await hq.access(scope, request.signal)
      if (controller === request) {
        delegation.value = next
        if (next.enabled) await hq.bind(scope, true)
      }
    } catch {
      if (controller === request) accessError.value = true
    } finally {
      finish(request)
    }
  }

  function changeScope() {
    reset()
    void refreshAccess()
  }

  onMounted(changeScope)
  watch([() => user.value?.id, currentId, currentLocationId, () => currentMembership.value?.id, () => queries.scope.revision, isOwner, enabled, loading], () => {
    if (import.meta.client) changeScope()
  }, { flush: 'sync' })
  onScopeDispose(reset)

  function begin(operation: 'send' | 'confirm' | 'access') {
    const request = new AbortController()
    controller = request
    error.value = null
    pending.value = operation
    return request
  }

  function finish(request: AbortController) {
    if (controller !== request) return
    controller = null
    pending.value = null
  }

  function activeScope() {
    if (state.value !== 'ready' || (managed.value && !delegation.value?.enabled) || !currentId.value || !currentLocationId.value || pending.value || (managed.value && hq.waiting.value)) return
    return { shopId: currentId.value, locationId: currentLocationId.value }
  }

  async function authorize(allow: boolean) {
    const scope = accessScope.value
    if (!scope || pending.value === 'access') return
    reset()
    accessError.value = false
    const request = begin('access')
    try {
      const next = await hq.access(scope, request.signal, allow)
      if (controller === request) {
        delegation.value = next
        if (next.enabled) await hq.bind(scope, true)
      }
    } catch {
      if (controller === request) accessError.value = true
    } finally {
      finish(request)
    }
  }

  function newChat() {
    reset()
    if (accessScope.value && delegation.value?.enabled) void hq.bind(accessScope.value, false)
  }

  async function send() {
    const scope = activeScope()
    const text = draft.value.trim()
    if (!scope || proposal.value || !text || text.length > maximumLength) return
    if (managed.value && new TextEncoder().encode(text).length > maximumLength) {
      error.value = 'tooLong'
      return
    }

    const request = begin('send')
    const message = { id: ++nextMessageId, role: 'user', text } as const
    if (!managed.value) messages.value.push(message)
    draft.value = ''
    const history = (managed.value ? [...managedMessages.value, message] : messages.value)
      .filter((entry): entry is Message & { role: 'user' | 'assistant' } => entry.role !== 'receipt')
      // An in-flight turn makes the sequence odd. Keep complete user/assistant pairs.
      .slice(-(maximumHistory - 1))
      .map(entry => ({ role: entry.role, content: entry.text.slice(0, maximumLength).replace(/[\uD800-\uDBFF]$/u, '') }))

    try {
      if (managed.value) {
        await hq.send(scope, history, request.signal)
        return
      }
      const reply = await $fetch<ChatReply>('/api/assistant/chat', {
        method: 'POST', body: { ...scope, messages: history }, signal: request.signal,
      })
      if (controller !== request) return
      if (!reply.text?.trim()) throw new Error('Missing assistant reply')
      messages.value.push({ id: ++nextMessageId, role: 'assistant', text: reply.text, destination: reply.link?.destination })
      proposal.value = reply.proposal ?? null
    } catch (cause) {
      if (controller !== request) return
      if (!managed.value) messages.value.pop()
      draft.value = text
      error.value = errorFor(cause, 'message')
    } finally {
      finish(request)
    }
  }

  async function confirmExpense() {
    const scope = activeScope()
    const selected = proposal.value
    if (!scope || !selected) return

    const request = begin('confirm')
    try {
      const result = await $fetch<{ expenseId: string }>('/api/assistant/confirm', {
        method: 'POST', body: { ...scope, token: selected.token }, signal: request.signal,
      })
      if (controller !== request) return
      if (!result.expenseId) throw new Error('Missing expense receipt')
      proposal.value = null
      messages.value.push({ id: ++nextMessageId, role: 'receipt', text: copy.value.recorded, destination: 'expenses' })
      queries.invalidate([
        'shop-data:expenses', 'shop-data:expense-categories', 'rpc:list_expenses', 'table:expense_categories',
        'shop-data:operating-report', 'shop-data:operational-report', 'shop-data:operational-report-highlights', 'rpc:shop_operational_report', 'rpc:shop_operating_report',
      ])
    } catch (cause) {
      if (controller !== request) return
      error.value = errorFor(cause, 'confirm')
      if (error.value === 'expired' || error.value === 'changed' || error.value === 'access') proposal.value = null
    } finally {
      finish(request)
    }
  }

  function discard() {
    if (pending.value) return
    proposal.value = null
    // If delivery of a confirmation was uncertain, keep that status visible.
    if (error.value !== 'confirm') error.value = null
  }

  return { copy: chatCopy, view, draft, maximumLength, send, confirmExpense, discard, reset: newChat, authorize }
}
