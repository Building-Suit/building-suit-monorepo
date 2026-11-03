import type { AgentOfficeCopy, AgentOfficeTaskDraft, AgentOfficeRoom } from '@building-suit/ui/types/agentOfficePresentation'
import type { HqState } from '#shared/types/hq'
export function useCompanyHq() {
  const { t, tm, locale, setLocale } = useI18n()
  const state = ref<HqState | null>(null)
  const loading = ref(true), pending = ref(false), authenticated = ref(false)
  const error = ref<string | null>(null), messageError = ref<string | null>(null), taskError = ref<string | null>(null)
  const messageDraft = ref(''), conversationOpen = ref(false), taskOpen = ref(false)
  const emptyDraft = (): AgentOfficeTaskDraft => ({ title: '', brief: '', acceptance: '', allowedActions: '' })
  const taskDraft = ref(emptyDraft())
  const configured = ref(false)
  const readOnly = computed(() => !authenticated.value || !configured.value || loading.value || !!error.value)
  const content = computed(() => ({ brandName: 'Building Suit HQ', brandSubtitle: t('hq.subtitle'), logoSrc: '/brand/building-suit-logo-light.png', sceneSrc: '/hq-assets/office-scene.png', sceneAlt: t('hq.sceneAlt'), copy: Object.fromEntries(Object.keys(tm('hq.copy')).map(k => [k, t('hq.copy.' + k)])) as unknown as AgentOfficeCopy }))
  const rooms = computed<AgentOfficeRoom[]>(() => {
    const status = (id: string) => { const s = state.value?.agents.find(a => a.id === id)?.status || 'idle'; return t('hq.' + s) }
    return [
      { id: 'ceo', label: t('hq.ceo'), kind: 'executive', active: true, x: 52, y: 14, statusLabel: status('ceo'), description: t('hq.ceoDescription'), skills: locale.value === 'ar' ? ['التخطيط','التفويض','المراجعة'] : ['Planning','Delegation','Review'], reportingLabel: t('hq.founder') },
      { id: 'hr', label: t('hq.hr'), kind: 'department', active: true, x: 33, y: 20, statusLabel: status('hr'), description: t('hq.hrDescription'), skills: locale.value === 'ar' ? ['التوظيف','تقييم المهارات','تخطيط القوى العاملة'] : ['Recruitment','Skill assessment','Workforce planning'], reportingLabel: t('hq.ceo') },
      ...[[74,24],[88,40],[71,60],[46,72],[27,57],[15,33]].map(([x,y],i) => ({ id: 'unassigned-' + i, label: t('hq.copy.unassignedTitle'), kind: 'unassigned' as const, active: false, x: x!, y: y!, statusLabel: '', description: t('hq.copy.unassignedDescription'), skills: [] })),
    ]
  })
  const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined, timeZone: 'Africa/Cairo' }).format(new Date(value))
  const tasks = computed(() => (state.value?.tasks || []).map(task => ({ ...task, ownerLabel: t('hq.' + task.owner), statusLabel: t('hq.statuses.' + task.status), updatedLabel: date(task.updatedAt), budgetLabel: t('hq.copy.taskBudgetValue'), deliverable: task.deliverable || undefined, reviewEvidence: task.reviewEvidence || undefined, canApprove: authenticated.value && task.status === 'proposed', canCancel: authenticated.value && !['completed','cancelled','failed'].includes(task.status) })))
  const messages = computed(() => (state.value?.messages || []).map(m => ({ ...m, role: m.role === 'founder' ? 'founder' as const : 'assistant' as const, authorLabel: t('hq.' + m.role), createdLabel: date(m.createdAt), statusLabel: t('hq.' + m.status) })))
  const brainNotes = computed(() => (state.value?.brain.notes || []).map((n,i) => ({ id: String(i), ...n })))
  const activity = computed(() => (state.value?.events || []).map(e => ({ ...e, createdLabel: date(e.createdAt) })))
  const connectionLabel = computed(() => !configured.value ? t('hq.unconfigured') : t('hq.onDemand'))
  let loadGeneration = 0
  let disposed = false
  async function load(background = false) {
    const generation = ++loadGeneration
    if (!background) loading.value = true
    error.value = null
    try {
      const result = await $fetch<{ state: HqState | null; authenticated: boolean; configured: boolean }>('/api/hq/state')
      if (disposed || generation !== loadGeneration) return
      state.value = result.authenticated ? result.state : null
      authenticated.value = result.authenticated
      configured.value = result.configured
    }
    catch {
      if (disposed || generation !== loadGeneration) return
      // A failed transport does not establish session loss. Keep drafts for retry.
      error.value = t('hq.error')
    }
    finally { if (!disposed && generation === loadGeneration) loading.value = false }
  }
  // Retain the key after a failed transport so retries cannot duplicate a saved command.
  let retryCommand: { fingerprint: string; key: string } | null = null
  async function action(body: Record<string, unknown>, target: 'message' | 'task') {
    if (pending.value || readOnly.value) return false
    pending.value = true; const feedback = target === 'message' ? messageError : taskError; feedback.value = null
    const fingerprint = JSON.stringify(body)
    if (retryCommand?.fingerprint !== fingerprint) retryCommand = { fingerprint, key: crypto.randomUUID() }
    try { await $fetch('/api/hq/action', { method: 'POST', body: { ...body, idempotencyKey: retryCommand!.key } }); retryCommand = null; await load(); return true }
    catch { feedback.value = t('hq.error'); return false }
    finally { pending.value = false }
  }
  async function sendMessage(text: string) { if (await action({ action: 'send_message', text }, 'message')) messageDraft.value = '' }
  async function createTask(draft: AgentOfficeTaskDraft) { if (await action({ action: 'create_task', ...draft, owner: 'ceo', budget: 0 }, 'task')) { taskDraft.value = emptyDraft(); taskOpen.value = false } }
  async function approveTask(id: string) { await action({ action: 'approve_task', id }, 'task') }
  const { ask: askConfirmation } = useConfirmation()
  async function cancelTask(id: string) { if (await askConfirmation({ title: t('hq.copy.cancelTask'), message: t('hq.copy.approvedScopeNotice') })) await action({ action: 'cancel_task', id }, 'task') }
  async function signOut() {
    if (pending.value) return
    ++loadGeneration // Older authenticated responses may never revive a signed-out view.
    pending.value = true
    try {
      await $fetch('/api/hq/auth/logout', { method: 'POST' })
      state.value = null; authenticated.value = false
      messageDraft.value = ''; taskDraft.value = emptyDraft()
      conversationOpen.value = false; taskOpen.value = false
      await load()
    }
    catch { error.value = t('hq.error'); loading.value = false }
    finally { pending.value = false }
  }
  let refreshTimer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    void load()
    refreshTimer = setInterval(() => {
      if (authenticated.value && !pending.value && !loading.value && document.visibilityState === 'visible') void load(true)
    }, 15_000)
  })
  onScopeDispose(() => { disposed = true; ++loadGeneration; clearInterval(refreshTimer) })
  watch(authenticated, value => { if (!value) { messageDraft.value = ''; taskDraft.value = emptyDraft(); conversationOpen.value = false; taskOpen.value = false } })
  return { content, rooms, tasks, messages, brainNotes, activity, loading, pending, error, readOnly, connectionLabel, messageError, taskError, messageDraft, taskDraft, conversationOpen, taskOpen, authenticated, load, sendMessage, createTask, approveTask, cancelTask, signOut, setLocale, locale }
}
