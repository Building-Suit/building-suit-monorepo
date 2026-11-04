import type { LivingOfficeEmployee, LivingOfficeSceneCopy } from '@building-suit/ui/types/livingOffice'
import type { AgentOfficeCopy, AgentOfficeTaskDraft, AgentOfficeRoom, LivingOfficePageCopy, AgentOfficeWorkCopy, AgentOfficeWorkflowDraft } from '@building-suit/ui/types/agentOfficePresentation'
import type { HqState } from '#shared/types/hq'
export function useCompanyHq() {
  const { t, tm, locale, setLocale } = useI18n()
  const state = ref<HqState | null>(null)
  const loading = ref(true), pending = ref(false), authenticated = ref(false)
  const error = ref<string | null>(null), messageError = ref<string | null>(null), taskError = ref<string | null>(null)
  const messageDraft = ref(''), conversationOpen = ref(false), taskOpen = ref(false)
  const emptyDraft = (): AgentOfficeTaskDraft => ({ title: '', brief: '', acceptance: '', allowedActions: '' })
  const taskDraft = ref(emptyDraft())
  const workflowOpen = ref(false)
  const emptyWorkflow = (): AgentOfficeWorkflowDraft => ({ id: '', brainFiles: {} })
  const workflowDraft = ref(emptyWorkflow())
  const configured = ref(false)
  const readOnly = computed(() => !authenticated.value || !configured.value || loading.value || !!error.value)
  const content = computed(() => ({ brandName: 'Building Suit HQ', brandSubtitle: t('hq.subtitle'), logoSrc: '/brand/building-suit-logo-light.png', sceneSrc: '/hq-assets/office-scene.png', sceneAlt: t('hq.sceneAlt'), copy: Object.fromEntries(Object.keys(tm('hq.copy')).map(k => [k, t('hq.copy.' + k)])) as unknown as AgentOfficeCopy }))
  const translate = (en: string, ar: string) => locale.value === 'ar' ? ar : en
  const workCopy = computed<AgentOfficeWorkCopy>(() => ({
    planFromMessage: translate('Plan work from this message', 'خطط للعمل من هذه الرسالة'), linkedTask: translate('Linked task', 'المهمة المرتبطة'), originalMessage: translate('Original message to Steve', 'الرسالة الأصلية إلى ستيف'),
    privateContextNotice: translate('Your original conversation stays with Steve. Review the task brief before saving: this separate brief will be shared with Noah, Iris and Maya after your approval. Saving a proposal does not approve work.', 'تبقى محادثتك الأصلية مع ستيف. راجع وصف المهمة قبل الحفظ: سيشارك هذا الوصف المنفصل مع نوح وآيريس ومايا بعد موافقتك. حفظ المقترح ليس موافقة على العمل.'),
    authorizeBrainWork: translate('Authorize Brain work', 'تفويض العمل بالمعرفة'), workflowTitle: translate('Approve the Brain files for this task', 'اعتماد ملفات المعرفة لهذه المهمة'), workflowIntro: translate('Choose the exact current role and policy files this approved assignment may read. Changes require a new proposal.', 'اختر ملفات الأدوار والسياسات الحالية التي يمكن لهذه المهمة المعتمدة قراءتها. تتطلب التغييرات مقترحاً جديداً.'),
    workflowScope: translate('Read only. No public browsing, Brain changes, spending or daily schedule. Your task brief and independent review remain required.', 'للقراءة فقط. لا تصفح عام أو تغييرات بالمعرفة أو إنفاق أو جدول يومي. يظل وصف المهمة والمراجعة المستقلة مطلوبين.'),
    workflowUnavailable: translate('Authorization saves this scope. Execution still requires an approved host, model allowance and live Brain access.', 'يحفظ التفويض هذا النطاق. لا يزال التنفيذ يتطلب استضافة معتمدة وحصة نموذج والوصول المباشر للمعرفة.'),
    fileReferenceHint: translate('Paste the exact Google Drive/Docs file link or file ID. Every file must be distinct.', 'الصق رابط ملف Google Drive أو Docs المحدد أو معرّفه. يجب أن يكون كل ملف مختلفاً.'), authorizeWorkflow: translate('Authorize read-only work', 'تفويض العمل للقراءة فقط'), workflowAuthorized: translate('Read-only Brain scope authorized', 'تم اعتماد نطاق المعرفة للقراءة فقط'),
  }))
  const workflowFields = computed(() => [
    ['AG-CEO-001', 'Steve profile', 'ملف ستيف'], ['AG-HR-001', 'Maya profile', 'ملف مايا'], ['AG-HR-002', 'Noah profile', 'ملف نوح'], ['AG-HR-003', 'Iris profile', 'ملف آيريس'],
    ['playbook', 'Operating playbook', 'دليل التشغيل'], ['bootstrap', 'Bootstrap instructions', 'تعليمات البداية'], ['charter', 'Company charter', 'ميثاق الشركة'], ['workingAgreement', 'Working agreement', 'اتفاق العمل'], ['registry', 'Agent registry', 'سجل الوكلاء'], ['organization', 'Organization', 'الهيكل التنظيمي'], ['hrCharter', 'HR charter', 'ميثاق الموارد البشرية'], ['workforceSkill', 'Workforce skill', 'مهارة الفريق'], ['home', 'Brain home', 'صفحة المعرفة الرئيسية'], ['soul', 'Company principles', 'مبادئ الشركة'], ['milestones', 'Company milestones', 'مراحل الشركة'], ['mode', 'Selected operating mode', 'نمط التشغيل المختار'],
  ].map(([key, en, ar]) => ({ key: key!, label: translate(en!, ar!) })))
  const sourceMessageText = computed(() => state.value?.messages.find(message => message.id === taskDraft.value.sourceMessageId)?.text || '')
  const livingCopy = computed<LivingOfficePageCopy>(() => ({
    title: translate('Your company, in motion', 'شركتك في مشهد حي'), intro: translate('Explore the people, plans and evidence behind the work. Room and camera motion are illustrative; work status comes from saved records.', 'استكشف الأشخاص والخطط وأدلة العمل. حركة الغرف والكاميرا توضيحية؛ حالات العمل من السجلات المحفوظة.'),
    createDepartment: translate('Create department', 'إنشاء قسم'), departmentName: translate('Department name', 'اسم القسم'), purpose: translate('Purpose', 'الغرض'), createOffice: translate('Create office', 'إنشاء المكتب'),
    milestoneTitle: translate('Milestone title', 'عنوان المرحلة'), milestoneAcceptance: translate('Milestone acceptance', 'معايير قبول المرحلة'), addMilestone: translate('Add milestone', 'إضافة مرحلة'), milestones: translate('Milestones', 'المراحل'), planned: translate('Planned', 'مخطط'), milestoneHint: translate('Milestones define the proposed scope. Completion requires evidence; approval locks this plan.', 'تحدد المراحل نطاق الخطة. يتطلب الإنجاز دليلاً؛ وتثبت الموافقة هذه الخطة.'),
    configured: translate('Configured team', 'الفريق المحدد'), execution: translate('Live execution unavailable', 'التنفيذ المباشر غير متاح'), noWrites: translate('No live Brain writes are enabled. Inbound markers represent recorded reads only.', 'لا توجد كتابة مباشرة مفعلة للمعرفة. تشير العلامات الواردة إلى قراءات مسجلة فقط.'), departmentCreated: translate('Department office created', 'تم إنشاء مكتب القسم'),
  }))
  const sceneCopy = computed<LivingOfficeSceneCopy>(() => ({
    title: translate('Interactive 3D office', 'مكتب ثلاثي الأبعاد تفاعلي'), hint: translate('Drag to orbit · scroll to zoom · select a person or room. Motion illustrates saved state, not live model execution.', 'اسحب للدوران وكبّر بالتمرير واختر شخصاً أو غرفة. الحركة توضح الحالة المسجلة ولا تثبت تنفيذ النموذج.'), fallback: translate('3D rendering unavailable. Use the accessible directory below.', 'العرض ثلاثي الأبعاد غير متاح. استخدم دليل الفريق أدناه.'), loading: translate('Building your office…', 'جار بناء المكتب…'),
    zoomIn: t('hq.copy.zoomIn'), zoomOut: t('hq.copy.zoomOut'), reset: t('hq.copy.resetView'), rotateLeft: translate('Rotate left', 'تدوير لليسار'), rotateRight: translate('Rotate right', 'تدوير لليمين'), motion: translate('Illustrative motion', 'حركة توضيحية'), pauseMotion: translate('Pause motion', 'إيقاف الحركة'), resumeMotion: translate('Resume motion', 'استئناف الحركة'), directory: t('hq.copy.roomList'), brain: t('hq.copy.brainLabel'), empty: translate('No employees in this office', 'لا يوجد موظفون في هذا المكتب'), departments: translate('Offices', 'المكاتب'), employees: translate('People', 'الأشخاص'),
  }))
  const rooms = computed<AgentOfficeRoom[]>(() => [
    { id: 'ceo', label: translate('Executive Office', 'المكتب التنفيذي'), kind: 'executive', active: true, x: 0, y: 0, statusLabel: '', description: t('hq.ceoDescription'), skills: [], reportingLabel: 'Tareq' },
    ...(state.value?.departments || [{ id: 'hr', name: 'HR & Agent Development', description: t('hq.hrDescription') }]).map(d => ({ id: d.id, label: d.id === 'hr' ? t('hq.hr') : d.name, kind: 'department' as const, active: true, x: 0, y: 0, statusLabel: '', description: d.description, skills: [], reportingLabel: 'Steve' })),
  ])
  const employees = computed<LivingOfficeEmployee[]>(() => (state.value?.employees || [
    { id: 'AG-CEO-001', name: 'Steve', role: 'CEO', departmentId: 'ceo', reportsTo: 'Tareq', status: 'idle' as const },
    { id: 'AG-HR-001', name: 'Maya', role: 'HR Lead', departmentId: 'hr', reportsTo: 'Steve', status: 'idle' as const },
    { id: 'AG-HR-002', name: 'Noah', role: 'Recruiter', departmentId: 'hr', reportsTo: 'Maya', status: 'idle' as const },
    { id: 'AG-HR-003', name: 'Iris', role: 'Evaluator', departmentId: 'hr', reportsTo: 'Maya', status: 'idle' as const },
  ]).map(e => ({ ...e, statusLabel: e.status === 'queued' || e.status === 'blocked' ? t('hq.statuses.' + e.status) : t('hq.' + e.status), reportsTo: ({ founder: 'Tareq', 'AG-CEO-001': 'Steve', 'AG-HR-001': 'Maya' } as Record<string,string>)[e.reportsTo] || e.reportsTo })))
  const brainSnapshotReady = computed(() => authenticated.value && state.value !== null)
  const brainActivity = computed(() => (state.value?.brain.events || []).map(e => ({ id: e.id, direction: e.direction, employeeId: e.agentId, label: translate('Recorded Brain read', 'قراءة مسجلة للمعرفة') + ' · ' + e.fileCount })))
  const runtimeNotice = computed(() => translate('Live execution unavailable: model authorization, a verified $0 allowance, live Brain access and durable hosting are not configured. Messages can be saved; replies require an authorized CEO.', 'التنفيذ المباشر غير متاح: لم يتم إعداد تفويض النموذج أو حصة مجانية موثقة أو الوصول المباشر للمعرفة أو الاستضافة الدائمة. يمكن حفظ الرسائل؛ والردود تتطلب مديراً تنفيذياً معتمداً.'))
  const departmentDraft = ref({ name: '', description: '' }), departmentOpen = ref(false)
  const milestoneDraft = ref({ title: '', acceptance: '' })
  const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined, timeZone: 'Africa/Cairo' }).format(new Date(value))
  const tasks = computed(() => (state.value?.tasks || []).map(task => ({ ...task, sourceMessageId: task.sourceMessage?.id, workflowAuthorized: !!task.workflow, canAuthorizeWorkflow: authenticated.value && !!task.sourceMessage && !!task.approvedAt && task.status === 'queued' && !task.workflow, ownerLabel: t('hq.' + task.owner), statusLabel: t('hq.statuses.' + task.status), updatedLabel: date(task.updatedAt), budgetLabel: t('hq.copy.taskBudgetValue'), deliverable: task.deliverable || undefined, reviewEvidence: task.reviewEvidence || undefined, canApprove: authenticated.value && task.status === 'proposed', canCancel: authenticated.value && !['completed','cancelled','failed'].includes(task.status) })))
  const messages = computed(() => (state.value?.messages || []).map(m => {
    const linked = state.value?.tasks.find(task => task.sourceMessage?.id === m.id)
    return { ...m, taskId: linked?.id || m.taskId, canPlanWork: authenticated.value && m.role === 'founder' && m.status === 'queued' && !linked && !m.taskId, role: m.role === 'founder' ? 'founder' as const : 'assistant' as const, authorLabel: t('hq.' + m.role), createdLabel: date(m.createdAt), statusLabel: t('hq.' + m.status) }
  }))
  const brainNotes = computed(() => (state.value?.brain.notes || []).map((n,i) => ({ id: String(i), ...n })))
  const activity = computed(() => (state.value?.events || []).map(e => ({ ...e, createdLabel: date(e.createdAt) })))
  const connectionLabel = computed(() => !configured.value ? t('hq.unconfigured') : translate('4 configured roles · execution offline', '٤ أدوار محددة · التنفيذ غير متصل'))
  let loadGeneration = 0
  let disposed = false
  let intentGeneration = 0
  async function load(background = false) {
    if (disposed) return
    const generation = ++loadGeneration
    if (!background) loading.value = true
    error.value = null
    try {
      const result = await $fetch<{ state: HqState | null; authenticated: boolean; configured: boolean }>('/api/hq/state')
      if (disposed || generation !== loadGeneration) return
      state.value = result.authenticated ? result.state : null
      authenticated.value = result.authenticated
      configured.value = result.configured
      reconcileWorkflowScope()
    }
    catch {
      if (disposed || generation !== loadGeneration) return
      // A failed transport does not establish session loss. Keep drafts for retry.
      error.value = t('hq.error')
    }
    finally { if (!disposed && generation === loadGeneration) loading.value = false }
  }
  // Retain the key after a failed transport so retries cannot duplicate a saved command.
  const retryCommands = new Map<string, string>()
  async function action(body: Record<string, unknown>, target: 'message' | 'task') {
    if (disposed || pending.value || readOnly.value) return false
    const intent = intentGeneration
    pending.value = true; const feedback = target === 'message' ? messageError : taskError; feedback.value = null
    const fingerprint = JSON.stringify(body)
    if (!retryCommands.has(fingerprint)) {
      if (retryCommands.size >= 64) { feedback.value = t('hq.error'); pending.value = false; return false }
      retryCommands.set(fingerprint, crypto.randomUUID())
    }
    try { await $fetch('/api/hq/action', { method: 'POST', body: { ...body, idempotencyKey: retryCommands.get(fingerprint)! } }); if (disposed || intent !== intentGeneration) return false; retryCommands.delete(fingerprint); await load(); return !disposed && intent === intentGeneration }
    catch { if (!disposed && intent === intentGeneration) feedback.value = t('hq.error'); return false }
    finally { pending.value = false }
  }
  async function sendMessage(text: string) { if (await action({ action: 'send_message', text }, 'message')) messageDraft.value = '' }
  async function createTask(draft: AgentOfficeTaskDraft) { if (await action({ action: 'create_task', ...draft, owner: 'ceo', budget: 0 }, 'task')) { taskDraft.value = emptyDraft(); taskOpen.value = false } }
  async function createDepartment(draft: { name: string; description: string }) { if (await action({ action: 'create_department', ...draft }, 'task')) { departmentDraft.value = { name: '', description: '' }; departmentOpen.value = false } }
  async function addMilestone(draft: { id: string; title: string; acceptance: string }) { if (await action({ action: 'add_milestone', ...draft }, 'task')) milestoneDraft.value = { title: '', acceptance: '' } }
  async function approveTask(id: string) { await action({ action: 'approve_task', id }, 'task') }
  const { ask: askConfirmation } = useConfirmation()
  async function planMessage(id: string) {
    const intent = intentGeneration
    if (disposed || readOnly.value || pending.value || !messages.value.some(message => message.id === id && message.canPlanWork)) return
    if (Object.values(taskDraft.value).some(value => value.trim()) && !await askConfirmation({ title: workCopy.value.planFromMessage, message: translate('Replace the unsaved task draft?', 'هل تريد استبدال مسودة المهمة غير المحفوظة؟') })) return
    if (disposed || intent !== intentGeneration || readOnly.value || pending.value || !messages.value.some(message => message.id === id && message.canPlanWork)) return
    // No private conversation is copied into the shared brief without founder review.
    taskDraft.value = { ...emptyDraft(), title: translate('Work requested through Steve', 'عمل مطلوب عبر ستيف'), sourceMessageId: id }
    taskError.value = null; conversationOpen.value = false; taskOpen.value = true
  }
  async function prepareWorkflow(id: string) {
    const intent = intentGeneration
    if (disposed || readOnly.value || pending.value || !tasks.value.some(task => task.id === id && task.canAuthorizeWorkflow)) return
    if (workflowDraft.value.id !== id && Object.values(workflowDraft.value.brainFiles).some(value => value.trim()) && !await askConfirmation({ title: workCopy.value.authorizeBrainWork, message: translate('Replace the unsaved file selection?', 'هل تريد استبدال اختيار الملفات غير المحفوظ؟') })) return
    if (disposed || intent !== intentGeneration || readOnly.value || pending.value || !tasks.value.some(task => task.id === id && task.canAuthorizeWorkflow)) return
    if (workflowDraft.value.id !== id) workflowDraft.value = { id, brainFiles: Object.fromEntries(workflowFields.value.map(field => [field.key, ''])) }
    taskError.value = null; workflowOpen.value = true
  }
  function brainFileId(value: string) {
    const text = value.trim()
    if (/^[A-Za-z0-9_-]{1,120}$/.test(text)) return text
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Invalid file reference')
    const match = url.hostname === 'drive.google.com' ? /^\/file\/d\/([A-Za-z0-9_-]{1,120})(?:\/|$)/.exec(url.pathname) : url.hostname === 'docs.google.com' ? /^\/document\/d\/([A-Za-z0-9_-]{1,120})(?:\/|$)/.exec(url.pathname) : null
    if (!match) throw new Error('Invalid file reference')
    return match[1]!
  }
  function reconcileWorkflowScope() {
    if (!authenticated.value || !workflowDraft.value.id) return
    const saved = state.value?.tasks.find(task => task.id === workflowDraft.value.id)?.workflow
    if (!saved || saved.daily || saved.allowedTools.length || saved.publicInputs.length) return
    try {
      const fields = workflowFields.value
      if (Object.keys(saved.brainFiles).length !== fields.length || Object.keys(workflowDraft.value.brainFiles).length !== fields.length) return
      if (!fields.every(field => saved.brainFiles[field.key as keyof typeof saved.brainFiles] === brainFileId(workflowDraft.value.brainFiles[field.key] || ''))) return
      // A lost POST response is resolved only by the matching, authenticated persisted scope.
      const brainFiles = Object.fromEntries(fields.map(field => [field.key, brainFileId(workflowDraft.value.brainFiles[field.key] || '')]))
      retryCommands.delete(JSON.stringify({ action: 'authorize_workflow', id: workflowDraft.value.id, brainFiles, allowedTools: [], publicInputs: [], daily: false, timezoneConfirmed: false }))
      workflowOpen.value = false; workflowDraft.value = emptyWorkflow(); taskError.value = null
    } catch { /* Invalid or different drafts remain available for correction; never dispatch here. */ }
  }
  async function authorizeWorkflow(draft: AgentOfficeWorkflowDraft) {
    if (disposed || readOnly.value || pending.value || draft.id !== workflowDraft.value.id || !tasks.value.some(task => task.id === draft.id && task.canAuthorizeWorkflow)) return
    let brainFiles: Record<string, string>
    try {
      if (Object.keys(draft.brainFiles).length !== workflowFields.value.length) throw new Error('Incomplete file scope')
      brainFiles = Object.fromEntries(workflowFields.value.map(field => [field.key, brainFileId(draft.brainFiles[field.key] || '')]))
      if (new Set(Object.values(brainFiles)).size !== workflowFields.value.length) throw new Error('Duplicate file scope')
    } catch { taskError.value = translate('Choose 16 distinct valid Drive/Docs files or file IDs. Your selection is preserved.', 'اختر ١٦ ملفاً مختلفاً وصحيحاً من Drive أو Docs أو معرّفات ملفات. تم الاحتفاظ باختيارك.'); return }
    if (await action({ action: 'authorize_workflow', id: draft.id, brainFiles, allowedTools: [], publicInputs: [], daily: false, timezoneConfirmed: false }, 'task')) { workflowOpen.value = false; workflowDraft.value = emptyWorkflow() }
  }
  async function cancelTask(id: string) {
    const intent = intentGeneration
    if (disposed || readOnly.value || pending.value) return
    if (await askConfirmation({ title: t('hq.copy.cancelTask'), message: t('hq.copy.approvedScopeNotice') }) && !disposed && intent === intentGeneration) await action({ action: 'cancel_task', id }, 'task')
  }
  async function signOut() {
    if (disposed || pending.value) return
    ++intentGeneration
    ++loadGeneration // Older authenticated responses may never revive a signed-out view.
    pending.value = true
    try {
      await $fetch('/api/hq/auth/logout', { method: 'POST' })
      state.value = null; authenticated.value = false
      messageDraft.value = ''; taskDraft.value = emptyDraft()
      conversationOpen.value = false; taskOpen.value = false; departmentOpen.value = false; departmentDraft.value = { name: '', description: '' }
      await load()
    }
    catch { error.value = t('hq.error'); loading.value = false }
    finally { pending.value = false }
  }
  let refreshTimer: ReturnType<typeof setInterval> | undefined
  let updates: EventSource | undefined, reconnect: ReturnType<typeof setTimeout> | undefined
  let mounted = false
  function closeUpdates() { updates?.close(); updates = undefined; clearTimeout(reconnect) }
  function connectUpdates() {
    if (!mounted || disposed || !authenticated.value || state.value?.storageMode !== 'sqlite' || document.visibilityState !== 'visible' || typeof EventSource === 'undefined' || updates) return
    updates = new EventSource('/api/hq/updates')
    updates.addEventListener('invalidate', () => { if (!pending.value && !loading.value) void load(true) })
    updates.onerror = () => { closeUpdates(); if (!disposed) reconnect = setTimeout(connectUpdates, 3_000) }
  }
  function visibility() { if (document.visibilityState !== 'visible') closeUpdates(); else { void load(true).then(connectUpdates) } }
  onMounted(() => {
    mounted = true
    void load().then(connectUpdates)
    document.addEventListener('visibilitychange', visibility)
    refreshTimer = setInterval(() => {
      if (authenticated.value && !pending.value && !loading.value && document.visibilityState === 'visible') void load(true).then(connectUpdates)
    }, 15_000)
  })
  onScopeDispose(() => { disposed = true; ++loadGeneration; ++intentGeneration; clearInterval(refreshTimer); closeUpdates(); if (mounted) document.removeEventListener('visibilitychange', visibility) })
  watch(authenticated, value => { ++intentGeneration; if (!value) { closeUpdates(); retryCommands.clear(); milestoneDraft.value = { title: '', acceptance: '' }; workflowOpen.value = false; workflowDraft.value = emptyWorkflow() } else connectUpdates() }, { flush: 'sync' })
  watch(authenticated, value => { if (!value) { messageDraft.value = ''; taskDraft.value = emptyDraft(); conversationOpen.value = false; taskOpen.value = false; departmentOpen.value = false; departmentDraft.value = { name: '', description: '' } } })
  return { workCopy, workflowFields, sourceMessageText, workflowOpen, workflowDraft, planMessage, prepareWorkflow, authorizeWorkflow, milestoneDraft, sceneCopy, livingCopy, employees, brainActivity, brainSnapshotReady, runtimeNotice, departmentDraft, departmentOpen, createDepartment, addMilestone, content, rooms, tasks, messages, brainNotes, activity, loading, pending, error, readOnly, connectionLabel, messageError, taskError, messageDraft, taskDraft, conversationOpen, taskOpen, authenticated, load, sendMessage, createTask, approveTask, cancelTask, signOut, setLocale, locale }
}
