<script setup lang="ts">
import designTokens from '@building-suit/design-tokens'
import { computed, nextTick, onScopeDispose, ref, shallowRef, useId, watch } from 'vue'
import { SPATIAL_VIEWPORT_GROUND_Y, spatialViewportFrame, spatialViewportGroundFootprint, spatialViewportScreenRectangle, useSpatialViewport, useSpatialWorkspaceSelection, useHqOfficeInspection } from '@building-suit/ux'
import type { HqBrainPresentation, HqCompanyPlansPresentation, HqDepartmentOffice, HqFounderAccessPresentation, HqLayoutContent, HqUserPresentation, HqStaffingCopy, HqStaffingDecision, HqStaffingPresentation } from '../types/hqLayoutPresentation'
import type { HqAgentPresentation, HqAgentsPresentation, HqTrialCommand, HqRetailCategory } from '../types/hqAgentsPresentation'
import type { HqMeetingCommand, HqMeetingPresentation } from '../types/hqMeetingPresentation'
import BsHqTeamChart from '../organisms/BsHqTeamChart.vue'
import BsHqPlanBoard from '../organisms/BsHqPlanBoard.vue'
import BsHqMeetingPanel from '../organisms/BsHqMeetingPanel.vue'
import BsHqOfficeOverview from '../organisms/BsHqOfficeOverview.vue'
import BsHqCeoChat from '../organisms/BsHqCeoChat.vue'
import BsHqTaskBrowser from '../organisms/BsHqTaskBrowser.vue'
import BsHqWorkforce from '../organisms/BsHqWorkforce.vue'
import BsTabs from '../molecules/BsTabs.vue'
import BsHqStaffingPlans from '../organisms/BsHqStaffingPlans.vue'
import { hologramFloorRadius } from '../utils/hologramScene'
import { layoutDepartmentOffices, workplaceFootprint } from '../utils/departmentOfficeLayout.ts'
import type { OfficePlacement } from '../utils/departmentOfficeLayout.ts'
import { createHqIslandFootprint } from '../utils/hqIslandGeometry.ts'
import { useHqTaskBrowserSource } from '../utils/hqTaskBrowserSource'
import { HQ_ORB_CENTER_Y, HQ_ORB_SCALE } from '../utils/hologramPresentationGeometry.ts'

const confirmation = useConfirmation()
const taskSource = useHqTaskBrowserSource()
const trialConfirming = ref(false)
let trialDisposed = false
onScopeDispose(() => { trialDisposed = true })
const props = defineProps<{ content: HqLayoutContent; brain?: HqBrainPresentation; user?: HqUserPresentation; officeLayerCount?: number; access?: HqFounderAccessPresentation; companyPlans?: HqCompanyPlansPresentation; staffing?: HqStaffingPresentation; staffingCopy?: HqStaffingCopy; agents?: HqAgentsPresentation; meeting?: HqMeetingPresentation; departments?: readonly HqDepartmentOffice[] }>()
const emit = defineEmits<{ trialCommand: [command: HqTrialCommand]; refreshBrain: []; selectBrainNote: [id: string]; login: [email: string, password: string]; register: [email: string, password: string]; logout: []; refreshPlans: []; refreshStaffing: []; staffingDecision: [command: HqStaffingDecision]; staffingCancel: [sourceTaskId: string]; refreshAgents: []; sendCeoMessage: [message: string]; decidePlan: [id: string, revision: number, decision: 'approved' | 'rejected']; meetingCommand: [command: HqMeetingCommand] }>()
const selectedTrial = computed(() => props.agents?.trials?.find(trial => trial.agentId === selectedAgent.value?.id))
const selectedOrdinaryTrial = computed(() => selectedTrial.value?.ordinary)
const selectedRetailTrial = computed(() => selectedAgent.value?.id === 'AG-RES-002' ? selectedTrial.value?.publicRetail : undefined)
const retailCategory = ref<HqRetailCategory>('clothing')
function chooseRetailCategory(value: unknown) {
  if (value === 'clothing' || value === 'footwear' || value === 'homewares') retailCategory.value = value
}
const selectedResearchTrial = computed(() => selectedAgent.value?.id === 'AG-RES-002' ? selectedTrial.value?.publicResearch : undefined)
const publicTrialIsLatest = computed(() => Boolean(selectedResearchTrial.value?.trialId && selectedResearchTrial.value.trialId === selectedTrial.value?.trialId))
async function trialAction(command: HqTrialCommand) {
  if (command.action === 'clear-trial-feedback' || trialConfirming.value || props.agents?.trialPending || props.access?.status !== 'founder') return
  const agentId = selectedAgent.value?.id
  trialConfirming.value = true
  try {
    const start = command.action.startsWith('start-'), retail = command.action.includes('public-retail')
    const research = command.action.includes('public-research'), ordinary = !retail && !research
    const reviewer = selectedOrdinaryTrial.value?.reviewerId
    const reviewerName = props.agents?.agents.find(agent => agent.id === reviewer)?.name ?? reviewer ?? 'the bound independent reviewer'
    const accepted = await confirmation.ask({
      title: start ? retail ? 'Start Public Retail trial' : research ? 'Start Public Research trial' : 'Start assigned-skill trial'
        : retail ? 'Approve Public Retail qualification' : research ? 'Approve Public Research qualification' : 'Approve qualification',
      message: start ? retail
        ? 'Start the reviewed Public Retail contract evaluation for the selected fixed New Cairo shop category? It permits one generic public search with at most three results and no private task text, arbitrary URLs or outreach. The actual observed category remains distinct from unexercised examples; starting does not grant qualification.'
        : research ? 'Start Karim’s supervised tool trial under Nadia and independent review? It permits one fixed generic public search for up to three results, with no private task text or outreach. Starting does not grant qualification.'
          : `Start the selected assigned skill’s supplied-fixture trial for ${selectedAgent.value?.name}? The manager reviews first, then ${reviewerName} independently reviews the same artifact. ${agentId === 'AG-HR-003' ? 'Steve is the fixed independent reviewer for Iris; Iris cannot review herself. ' : ''}No network tools, customer work or external actions are permitted. Starting does not grant qualification.`
        : ordinary ? 'Record qualification from the completed current-binding manager and independent reviews? All assigned skills and canonical Active lifecycle remain required.'
          : 'Record qualification from the completed current-binding tool trial and its independent reviews? This does not authorize outreach or general browsing.',
      confirmLabel: start ? 'Start trial' : 'Approve qualification', cancelLabel: 'Cancel' })
    const current = retail ? selectedRetailTrial.value : research ? selectedResearchTrial.value : selectedOrdinaryTrial.value ?? selectedTrial.value
    const valid = start && 'skillFileId' in command
      ? current?.eligible && !current.qualified && current.status !== 'active' && current.skillFileId === command.skillFileId
        && (!ordinary || selectedOrdinaryTrial.value?.reviewerReady)
        && (!retail || command.action === 'start-public-retail' && selectedRetailTrial.value?.categories.includes(command.category))
        && !('bindingCurrent' in current && current.reviewComplete && current.bindingCurrent && !current.receiptIssued)
      : 'trialId' in command && current?.reviewComplete && current.trialId === command.trialId && !current.receiptIssued
        && (!('bindingCurrent' in current) || current.bindingCurrent)
        && (!ordinary || !selectedOrdinaryTrial.value || selectedOrdinaryTrial.value.reviewerReady)
    if (accepted && valid && !trialDisposed && props.access?.status === 'founder' && selectedAgent.value?.id === agentId && !props.agents?.trialPending) emit('trialCommand', command)
  } finally { trialConfirming.value = false }
}

const meetingVisible = ref(false)
function openMeeting() { closeConversation(false); meetingVisible.value = true; emit('meetingCommand', { type: 'refresh' }) }
const sceneRef = shallowRef<{ activateAt: (x: number, y: number) => boolean; setExcitedAt: (x: number, y: number, active: boolean) => boolean } | null>(null)
const brainPanelPresent = ref(false)
const workplacePanelPresent = ref(false)
const workplaceTitleRef = shallowRef<HTMLElement | null>(null)
const agentTitleRef = shallowRef<HTMLElement | null>(null)
const agentPanelId = useId(), agentTitleId = useId(), officeTabsId = useId()
const chatVisible = ref(false)
const chatDraft = ref('')
let chatDraftIdentity: string | null = null
const chatTitleRef = shallowRef<HTMLElement | null>(null)
const chatPanelId = useId(), chatTitleId = useId()
type SidebarSection = 'tasks' | 'plans' | 'team'
const conversationDetail = ref<SidebarSection | null>(null)
const teamVisible = computed(() => conversationDetail.value === 'team')
const plansVisible = computed(() => conversationDetail.value === 'plans')
const teamAgentId = ref<string | null>(null)
const sidebarTitle = computed(() => {
  const copy = props.content.agents?.workforce
  switch (conversationDetail.value) {
    case 'team': return copy?.teamLabel
    case 'tasks': return props.content.tasksLabel
    case 'plans': return props.content.workplaces.plansLabel
    default: return ''
  }
})
type RecordKind = 'task' | 'lesson' | 'note' | 'plan' | 'staffing'
const recordDetail = shallowRef<{ kind: RecordKind; id: string; title?: string } | null>(null)
const recordTitleRef = shallowRef<HTMLElement | null>(null)
const recordTitleId = useId()
let recordReturnFocus: HTMLElement | null = null
const conversationDetailTitleRef = shallowRef<HTMLElement | null>(null)
const conversationDetailPanelId = useId(), conversationDetailTitleId = useId()
let chatReturnFocus: HTMLElement | null = null
let conversationDetailReturnFocus: HTMLElement | null = null
let agentReturnFocus: HTMLElement | null = null
watch(teamVisible, visible => { if (!visible) { teamAgentId.value = null; agentReturnFocus = null } })
const workplaceSelectRef = shallowRef<{ focus: () => void } | null>(null)
const officeLayout = computed(() => layoutDepartmentOffices(props.departments ?? []))
const islandFootprint = computed(() => createHqIslandFootprint(officeLayout.value))
const floorRadius = computed(() => Math.max(officeLayout.value.floorRadius, islandFootprint.value.radius, hologramFloorRadius(props.officeLayerCount)))
const availableWorkplaces = computed(() => [
  { ...officeLayout.value.executive, name: props.content.companyPlans.executiveLabel, executive: true },
  ...officeLayout.value.offices.map(office => ({ ...office, executive: false })),
])
const workplaceOptions = computed(() => availableWorkplaces.value.map(({ id, name }) => ({ id, name })))
const founderAccess = computed<HqFounderAccessPresentation>(() => props.access ?? { status: 'anonymous', pending: false })
const plansWorkspace = computed<HqCompanyPlansPresentation>(() => props.companyPlans ?? { status: 'unavailable', pending: false, plans: [] })
const agentsState = computed<HqAgentsPresentation>(() => props.agents ?? { status: 'unavailable', pending: false, sending: false, agents: [], messages: [], queuedCount: 0, runtimeOnline: false })
const displayedUser = computed(() => founderAccess.value.user ?? props.user)
const orbHovered = ref(false)
const feedback = (x: number, y: number, active: boolean) => { sceneRef.value?.setExcitedAt(x, y, active) }
const { viewportRef, camera, resetVersion, isInteracting, zoomPercent, canZoomIn, canZoomOut, onPointerDown, onPointerMove, onPointerEnd, onPointerLeave, onWheel, onKeydown, zoomBy, reset, transitionTo } = useSpatialViewport((x, y) => sceneRef.value?.activateAt(x, y), { onHover: feedback, onHold: feedback }, { zoomLocked: () => Boolean(focusedTargetId.value) || brainPanelPresent.value || workplacePanelPresent.value || chatVisible.value || meetingVisible.value || Boolean(conversationDetail.value) || Boolean(recordDetail.value), sceneRadius: () => floorRadius.value })
const viewportSize = shallowRef({ width: 1, height: 1 })
const { selectedId: focusedTargetId, select: focusTarget, clear: clearFocus, refit: refitFocus } = useSpatialWorkspaceSelection({
  camera, viewport: () => viewportSize.value, sceneRadius: () => floorRadius.value,
  overlayWidth: () => Math.min(Number.parseFloat(designTokens.component.hqGlass.panelWidth.value), Math.max(0, viewportSize.value.width - 24)) + 24,
  rtl: () => typeof window !== 'undefined' && Boolean(viewportRef.value) && getComputedStyle(viewportRef.value!).direction === 'rtl',
  transitionTo,
})
const brainVisible = computed(() => focusedTargetId.value === 'brain')
const selectedWorkplaceId = computed(() => focusedTargetId.value?.startsWith('workplace:') ? focusedTargetId.value.slice(10) : null)
const selectedWorkplace = computed(() => availableWorkplaces.value.find(workplace => workplace.id === selectedWorkplaceId.value) ?? null)
const selectedWorkplaceAgents = computed<readonly HqAgentPresentation[]>(() => {
  if (!selectedWorkplace.value) return []
  if (selectedWorkplace.value.executive) return agentsState.value.agents.filter(agent => agent.role === 'ceo')
  const assigned = officeLayout.value.offices.find(office => office.id === selectedWorkplaceId.value)?.agents
  return (assigned ?? agentsState.value.agents.filter(agent => agent.departmentId === selectedWorkplaceId.value)).map<HqAgentPresentation>(agent =>
    agentsState.value.agents.find(runtime => runtime.id === agent.id) ?? { id: agent.id, name: agent.name, role: 'agent', departmentId: selectedWorkplaceId.value, deskIndex: null, activity: 'unknown' })
})
const { section: officeSection, selectedAgentId, selectSection, selectAgent, closeAgent } = useHqOfficeInspection(
  () => selectedWorkplaceId.value, () => selectedWorkplaceAgents.value.map(agent => agent.id))
const selectedAgent = computed(() => teamVisible.value
  ? (founderAccess.value.status === 'founder' ? agentsState.value.agents.find(agent => agent.id === teamAgentId.value) ?? null : null)
  : selectedWorkplaceAgents.value.find(agent => agent.id === selectedAgentId.value) ?? null)
watch(() => selectedAgent.value?.id, () => emit('trialCommand', { action: 'clear-trial-feedback' }))
const selectedNote = computed(() => recordDetail.value?.kind === 'note' && props.brain?.selectedId === recordDetail.value.id ? props.brain?.note : null)
const recordTitle = computed(() => {
  const record = recordDetail.value
  if (!record) return ''
  if (record.kind === 'note') return selectedNote.value?.title ?? record.title ?? props.content.companyBrain.title
  if (record.kind === 'task') return record.title ?? agentsState.value.tasks?.find(task => task.id === record.id)?.title ?? props.content.tasksLabel
  if (record.kind === 'lesson') return agentsState.value.lessons?.find(lesson => lesson.id === record.id)?.title ?? props.content.agents?.workforce?.learningLabel
  if (record.kind === 'plan') return plansWorkspace.value.plans.find(plan => plan.id === record.id)?.title ?? props.content.workplaces.plansLabel
  if (record.kind === 'staffing') return props.staffing?.workflows.find(row => row.id === record.id)?.plan?.name ?? props.staffingCopy?.title
  return ''
})
const coverPrimary = computed(() => Boolean(recordDetail.value) && viewportSize.value.width <= 1250)
const officeCopy = computed(() => props.content.workplaces.office)
const officeTabs = computed(() => officeCopy.value ? [
  { value: 'overview', label: officeCopy.value.overview }, { value: 'tasks', label: props.content.agents?.workforce?.tasksLabel ?? officeCopy.value.runningTasks },
  { value: 'calendar', label: officeCopy.value.calendar }, { value: 'settings', label: officeCopy.value.settings },
] : [])
const officeRosterKnown = computed(() => selectedWorkplace.value?.executive ? agentsState.value.status === 'connected' : officeLayout.value.offices.find(office => office.id === selectedWorkplaceId.value)?.agents !== undefined)
async function openAgent(id: string) {
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) agentReturnFocus = document.activeElement
  selectAgent(id)
  await nextTick()
  if (selectedAgentId.value === id) agentTitleRef.value?.focus({ preventScroll: true })
}
async function openTeamAgent(id: string, event: MouseEvent) {
  if (!teamVisible.value || founderAccess.value.status !== 'founder' || !agentsState.value.agents.some(agent => agent.id === id)) return
  agentReturnFocus = event.currentTarget instanceof HTMLElement ? event.currentTarget : activeControl()
  teamAgentId.value = id
  await nextTick()
  if (teamVisible.value && teamAgentId.value === id) agentTitleRef.value?.focus({ preventScroll: true })
}
async function closeAgentPanel() {
  const target = agentReturnFocus
  if (teamVisible.value) teamAgentId.value = null
  else closeAgent()
  agentReturnFocus = null
  await nextTick()
  restoreControl(target, teamVisible.value ? conversationDetailTitleRef.value : workplaceTitleRef.value)
}
const workplaceVisible = computed(() => Boolean(selectedWorkplace.value))
watch([viewportSize, floorRadius], () => refitFocus())
let viewportObserver: ResizeObserver | undefined
watch(viewportRef, element => {
  viewportObserver?.disconnect()
  viewportObserver = undefined
  if (!element) return
  const measure = () => {
    const width = element.clientWidth, height = element.clientHeight
    if (width > 0 && height > 0 && (width !== viewportSize.value.width || height !== viewportSize.value.height)) viewportSize.value = { width, height }
  }
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    viewportObserver = new ResizeObserver(measure)
    viewportObserver.observe(element)
  }
}, { flush: 'post' })
onScopeDispose(() => { viewportObserver?.disconnect() })
const panelTitleRef = shallowRef<HTMLElement | null>(null)
const ui = useUiCopy()
let returnFocus: HTMLElement | null = null
const search = ref<string | number>('')
const noteLimit = ref(40)
const brainCopy = computed(() => props.content.companyBrain)
const brainTabsId = useId()
const brainTab = ref<'notes' | 'learning'>('notes')
const brainTabs = computed(() => [
  { value: 'notes', label: brainCopy.value.notesTabLabel },
  ...(props.content.agents?.workforce ? [{ value: 'learning', label: props.content.agents.workforce.learningLabel }] : []),
])
function selectBrainTab(value: string) {
  if (value === 'notes' || value === 'learning') {
    clearRecord()
    brainTab.value = value
  }
}
const brainStatus = computed(() => props.brain?.status ?? 'unavailable')
const brainStatusLabel = computed(() => {
  if (props.brain?.reason === 'not-configured') return brainCopy.value.setupRequiredLabel
  if (props.brain?.reason === 'authorization-required') return brainCopy.value.authorizationRequiredLabel
  return ({ loading: brainCopy.value.loadingLabel, connected: brainCopy.value.connectedLabel, unavailable: brainCopy.value.unavailableLabel, error: brainCopy.value.errorLabel })[brainStatus.value]
})
const visibleNotes = computed(() => {
  const query = String(search.value).trim().toLocaleLowerCase()
  return (props.brain?.notes ?? []).filter(note => !query || `${note.title} ${note.path}`.toLocaleLowerCase().includes(query))
})
const renderedNotes = computed(() => visibleNotes.value.slice(0, noteLimit.value))
watch(search, () => { noteLimit.value = 40 })
async function openBrain() {
  closeConversation(false)
  if (brainVisible.value) return
  brainTab.value = 'notes'
  emit('refreshBrain')
  rememberReturnFocus()
  brainPanelPresent.value = true
  focusTarget({ id: 'brain', x: 0, z: 0, width: 1.8 * HQ_ORB_SCALE, depth: 1.8 * HQ_ORB_SCALE, height: 2 * HQ_ORB_SCALE + HQ_ORB_CENTER_Y - 0.98, yaw: 0, viewYaw: 0.35, pitch: 0.2, distance: 5 * HQ_ORB_SCALE })
  await nextTick()
  if (brainVisible.value) panelTitleRef.value?.focus({ preventScroll: true })
}
function rememberReturnFocus() {
  if (focusedTargetId.value || typeof document === 'undefined') return
  const active = document.activeElement
  returnFocus = active instanceof HTMLElement && active !== document.body && active !== document.documentElement ? active : viewportRef.value
}
function closeSelection(restoreCamera = true) {
  clearRecord()
  closeAgent(); agentReturnFocus = null
  if (!clearFocus(restoreCamera)) return
  if (returnFocus?.isConnected && returnFocus.getClientRects().length && !returnFocus.closest('[hidden]')) returnFocus.focus({ preventScroll: true })
  else if (restoreCamera) workplaceSelectRef.value?.focus()
  else viewportRef.value?.focus({ preventScroll: true })
  returnFocus = null
}
function closeBrain(restoreCamera = true) { if (brainVisible.value) closeSelection(restoreCamera) }
async function openWorkplace(id: string) {
  const workplace = availableWorkplaces.value.find(item => item.id === id)
  if (!workplace) return
  closeConversation(false)
  closeAgent()
  selectSection('overview')
  rememberReturnFocus()
  workplacePanelPresent.value = true
  focusTarget(workplaceTarget(workplace))
  await nextTick()
  if (selectedWorkplaceId.value === id) workplaceTitleRef.value?.focus({ preventScroll: true })
}
function workplaceTarget(workplace: OfficePlacement & { id: string }) {
  // Focus the desks and usable work area; wide circular floor shares should
  // remain selectable without forcing a distant view of their empty edges.
  return {
    id: `workplace:${workplace.id}`,
    x: workplace.x, z: workplace.z,
    width: workplace.width, depth: workplace.depth,
    height: 1.9, bottom: SPATIAL_VIEWPORT_GROUND_Y + 0.14, yaw: workplace.yaw,
  }
}
function chooseWorkplace(value: string | number | null) {
  if (typeof value === 'string') void openWorkplace(value)
  else closeSelection()
}
function openPlans() { openHeaderPanel('plans') }
function refreshPlanBoard() {
  emit('refreshPlans')
  if (props.staffing) emit('refreshStaffing')
}
function activeControl() { return typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null }
function restoreControl(control: HTMLElement | null, fallback: HTMLElement | null) {
  if (control?.isConnected && control.getClientRects().length && !control.closest('[hidden], [inert]')) control.focus({ preventScroll: true })
  else fallback?.focus({ preventScroll: true })
}
async function openChat() {
  if (!chatVisible.value) chatReturnFocus = activeControl()
  chatVisible.value = true
  conversationDetail.value = null
  clearRecord()
  await nextTick()
  if (chatVisible.value) chatTitleRef.value?.focus({ preventScroll: true })
}
function closeConversation(restoreFocus = true) {
  const wasVisible = chatVisible.value || conversationDetail.value || recordDetail.value
  const target = chatReturnFocus ?? conversationDetailReturnFocus
  chatVisible.value = false; conversationDetail.value = null; clearRecord()
  chatReturnFocus = null; conversationDetailReturnFocus = null
  if (wasVisible && restoreFocus) void nextTick(() => restoreControl(target, viewportRef.value))
}
async function openConversationDetail(section: SidebarSection) {
  conversationDetailReturnFocus = activeControl()
  conversationDetail.value = section
  await nextTick()
  if (conversationDetail.value === section) conversationDetailTitleRef.value?.focus({ preventScroll: true })
}
async function closeConversationDetail() {
  const target = conversationDetailReturnFocus
  clearRecord()
  conversationDetail.value = null; conversationDetailReturnFocus = null
  await nextTick()
  restoreControl(target, chatVisible.value ? chatTitleRef.value : viewportRef.value)
}
async function openRecord(kind: RecordKind, id: string, title?: string) {
  recordReturnFocus = activeControl()
  closeAgent()
  recordDetail.value = { kind, id, title }
  if (kind === 'note') emit('selectBrainNote', id)
  await nextTick()
  if (recordDetail.value?.kind === kind && recordDetail.value.id === id) {
    recordTitleRef.value?.focus({ preventScroll: true })
  }
}
function clearRecord() { recordDetail.value = null; recordReturnFocus = null }
async function closeRecord() {
  const target = recordReturnFocus
  clearRecord()
  await nextTick()
  restoreControl(target, chatVisible.value ? chatTitleRef.value : conversationDetail.value ? conversationDetailTitleRef.value
    : brainVisible.value ? panelTitleRef.value : workplaceTitleRef.value ?? viewportRef.value)
}
function openHeaderPanel(section: SidebarSection) {
  if (section === 'team') { closeAgent(); teamAgentId.value = null }
  closeConversation(false)
  void openConversationDetail(section)
}
function showWorkspace() { closeConversation(false); closeSelection() }
function resetScene() { closeConversation(false); closeSelection(false); reset() }
function onWorkspaceKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && recordDetail.value) { event.preventDefault(); void closeRecord(); return }
  if (event.key === 'Escape' && teamVisible.value && selectedAgent.value) { event.preventDefault(); void closeAgentPanel(); return }
  if (event.key === 'Escape' && conversationDetail.value) { event.preventDefault(); void closeConversationDetail(); return }
  if (event.key === 'Escape' && chatVisible.value) { event.preventDefault(); closeConversation(); return }
  if (event.key === 'Escape' && selectedAgent.value) { event.preventDefault(); void closeAgentPanel(); return }
  if (event.key === 'Escape' && focusedTargetId.value) { event.preventDefault(); closeSelection(); return }
  // Notes retain native scrolling/navigation; manual camera zoom is locked
  // centrally while this panel is open, including shortcuts on the canvas.
  if (event.target instanceof Element && event.target.closest('.bs-hq-layout__brain-panel')) return
  onKeydown(event)
}
watch(resetVersion, () => closeSelection(false))
// Unsent text is local UI state, separate from private messages/authority.
// A transient offline/access check may unmount Chat; only the same verified
// identity may recover its in-memory draft. Terminal access clears it.
watch(() => {
  const access = founderAccess.value
  return { status: access.status, identity: access.status === 'founder' && access.user?.displayName
    ? JSON.stringify([access.user.displayName, access.user.detailLabel ?? '']) : null }
}, ({ status, identity }) => {
  if (status === 'anonymous' || status === 'denied') { chatDraft.value = ''; chatDraftIdentity = null }
  else if (identity) {
    if (chatDraftIdentity !== null && chatDraftIdentity !== identity) chatDraft.value = ''
    chatDraftIdentity = identity
  }
}, { immediate: true, flush: 'sync' })
onScopeDispose(() => { chatDraft.value = ''; chatDraftIdentity = null })
watch(() => founderAccess.value.status, (status, previous) => {
  if (previous === 'founder' && status !== 'founder') closeConversation(false)
  if (previous === 'founder' && status !== 'founder' && selectedWorkplaceId.value) closeSelection()
})
watch(() => availableWorkplaces.value.map(({ id, x, z, width, depth, yaw, sector }) => [id, x, z, width, depth, yaw, sector.startAngle, sector.endAngle, sector.innerRadius, sector.outerRadius].join(',')).join(';'), () => {
  if (!selectedWorkplaceId.value) return
  if (selectedWorkplace.value) focusTarget(workplaceTarget(selectedWorkplace.value))
  else closeSelection()
})
const userInitials = computed(() => displayedUser.value?.displayName.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('') ?? '')
const mapScale = computed(() => 45 / floorRadius.value)
const hintId = useId()
const islandClipId = useId()
const brainPanelId = useId()
const brainTitleId = useId()
const workplacePanelId = useId()
const workplaceTitleId = useId()
const mapPolygon = (points: readonly { x: number; z: number }[]) => points.map(point => `${(50 + point.x * mapScale.value).toFixed(3)},${(50 + point.z * mapScale.value).toFixed(3)}`).join(' ')
const islandMapOutline = computed(() => mapPolygon(islandFootprint.value.outline))
const officeFootprint = (office: OfficePlacement) => mapPolygon(workplaceFootprint(office))
const mapOffices = computed(() => [
  { id: officeLayout.value.executive.id, name: props.content.companyPlans.executiveLabel, executive: true, points: officeFootprint(officeLayout.value.executive), road: mapPolygon(officeLayout.value.executive.roadPoints) },
  ...officeLayout.value.offices.map(office => ({ id: office.id, name: office.name, executive: false, points: officeFootprint(office), road: mapPolygon(office.roadPoints) })),
])
const viewportFrame = computed(() => spatialViewportFrame(camera, viewportSize.value.width, viewportSize.value.height, floorRadius.value))
const groundFootprint = computed(() => mapPolygon(spatialViewportGroundFootprint(viewportFrame.value, floorRadius.value)))
// This outline preserves the screen aspect at the focus distance. The filled
// polygon separately shows the oblique frustum's actual finite-floor footprint.
const screenRectangle = computed(() => mapPolygon(spatialViewportScreenRectangle(viewportFrame.value)))
</script>

<template>
  <div class="bs-hq-layout">
    <main class="bs-hq-layout__workspace-area" :class="{ 'bs-hq-layout__workspace-area--brain': brainVisible || workplaceVisible || chatVisible || conversationDetail }" @keydown="onWorkspaceKeydown">
    <section ref="viewportRef" class="bs-hq-layout__canvas" :class="{ 'bs-hq-layout__canvas--interacting': isInteracting, 'bs-hq-layout__canvas--orb-hovered': orbHovered }" :aria-label="content.canvasLabel" :aria-describedby="hintId" tabindex="0" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerleave="onPointerLeave" @pointerup="onPointerEnd" @pointercancel="onPointerEnd" @lostpointercapture="onPointerEnd" @wheel="onWheel" @auxclick.prevent @contextmenu.prevent>
      <BsHologramScene ref="sceneRef" :camera="camera" :departments="departments" :agents="agentsState.agents" :avatar-assets="content.avatarAssets" :executive-label="content.companyPlans.executiveLabel" :selected-workplace-id="selectedWorkplaceId" :office-layer-count="officeLayerCount" :opened="brainVisible" :reset-version="resetVersion" :label="content.hologramLabel" :unavailable-label="content.sceneUnavailableLabel" @activate="openBrain" @select-workplace="openWorkplace" @hover-change="orbHovered = $event" />
      <div class="bs-hq-layout__brand" data-spatial-controls>
        <img :src="content.logoSrc" alt="" width="32" height="44">
        <h1>{{ content.brandName }} <span>{{ content.brandSuffix }}</span></h1>
      </div>
      <nav class="bs-hq-layout__navigation bs-hq-nav" :aria-label="content.workspaceLabel" data-spatial-controls>
        <BsButton variant="tab" class="bs-hq-layout__tab" :class="{ 'bs-hq-layout__tab--selected': !focusedTargetId && !conversationDetail && !chatVisible }" :aria-current="!focusedTargetId && !conversationDetail && !chatVisible ? 'page' : undefined" @click="showWorkspace">{{ content.workspaceLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" :disabled="!content.agents?.workforce" :class="{ 'bs-hq-layout__tab--selected': conversationDetail === 'tasks' && !chatVisible }" :aria-controls="conversationDetailPanelId" :aria-expanded="conversationDetail === 'tasks' && !chatVisible" @click="openHeaderPanel('tasks')">{{ content.tasksLabel }}</BsButton>
        <BsButton v-if="content.agents?.workforce && officeCopy" variant="tab" class="bs-hq-layout__tab" :class="{ 'bs-hq-layout__tab--selected': teamVisible }" :aria-controls="conversationDetailPanelId" :aria-expanded="teamVisible" @click="openHeaderPanel('team')">{{ content.agents.workforce.teamLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" :class="{ 'bs-hq-layout__tab--selected': conversationDetail === 'plans' }" :aria-controls="conversationDetailPanelId" :aria-expanded="conversationDetail === 'plans'" @click="openPlans">{{ content.workplaces.plansLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" disabled>{{ content.calendarLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" :class="{ 'bs-hq-layout__tab--selected': brainVisible }" :aria-label="brainCopy.openLabel" :aria-controls="brainPanelId" :aria-expanded="brainVisible" @click="openBrain">{{ content.brainLabel }}</BsButton>
        <div class="bs-hq-layout__workplace-picker" :class="{ 'bs-hq-layout__workplace-picker--selected': selectedWorkplace }" data-spatial-scroll>
          <BsSelect ref="workplaceSelectRef" :model-value="selectedWorkplaceId" :options="workplaceOptions" option-label="name" option-value="id" :label="content.workplaces.label" :placeholder="content.workplaces.label" :title="selectedWorkplace?.name ?? content.workplaces.label" append-to="self" scroll-height="clamp(88px, calc(100dvh - 210px), 224px)" @update:model-value="chooseWorkplace" @keydown.esc.stop />
          <BsButton v-if="selectedWorkplace" variant="icon" class="bs-hq-layout__workplace-clear" :aria-label="`${content.workplaces.clearSelectionLabel}: ${selectedWorkplace.name}`" :title="content.workplaces.clearSelectionLabel" @click="closeSelection()"><BsIcon name="close" :size="16" /></BsButton>
        </div>
      </nav>
      <aside class="bs-hq-layout__session" data-spatial-controls>
        <span class="bs-hq-layout__status"><span aria-hidden="true" />{{ content.statusLabel }}</span>
        <BsButton variant="accent" class="bs-hq-layout__ceo" :aria-controls="chatPanelId" :aria-expanded="chatVisible" @click="openChat"><BsIcon name="chat" :size="17" />{{ content.talkToCeoLabel }}</BsButton>
        <BsButton v-if="meeting" variant="secondary" class="bs-hq-layout__ceo" aria-haspopup="dialog" :aria-expanded="meetingVisible" @click="openMeeting"><BsIcon name="chat" :size="17" />{{ meeting.copy.labels.entry }}</BsButton>
        <BsButton v-if="displayedUser" variant="text" class="bs-hq-layout__account" :aria-label="content.companyPlans.executiveLabel" :aria-controls="conversationDetailPanelId" :aria-expanded="conversationDetail === 'plans'" @click="openPlans">
          <span class="bs-hq-layout__avatar"><img v-if="displayedUser.avatarUrl" :src="displayedUser.avatarUrl" alt="" width="30" height="30"><span v-else>{{ userInitials }}</span></span>
          <span class="bs-hq-layout__identity"><strong>{{ displayedUser.displayName }}</strong><small v-if="displayedUser.detailLabel">{{ displayedUser.detailLabel }}</small></span>
        </BsButton>
        <BsButton v-else variant="text" class="bs-hq-layout__login" :disabled="founderAccess.pending" :aria-controls="conversationDetailPanelId" :aria-expanded="conversationDetail === 'plans'" @click="openPlans"><BsIcon name="user" :size="18" />{{ content.loginLabel }}</BsButton>
        <BsButton v-if="founderAccess.status === 'founder'" variant="text" class="bs-hq-layout__login" :disabled="founderAccess.pending" @click="emit('logout')">{{ content.companyPlans.signOutLabel }}</BsButton>
      </aside>
      <div class="bs-hq-layout__footer" dir="ltr">
        <div class="bs-hq-layout__workspace-info" dir="auto">
          <p :id="hintId" class="bs-hq-layout__gesture-hint"><span class="bs-hq-layout__mouse-hint">{{ content.mouseControlsLabel }}</span><span class="bs-hq-layout__touch-hint">{{ content.touchControlsLabel }}</span><span class="bs-hq-layout__keyboard-hint">{{ content.keyboardControlsLabel }}</span></p>
        </div>
        <aside class="bs-hq-layout__view" :aria-label="content.minimapLabel" data-spatial-controls>
          <div class="bs-hq-layout__minimap" role="img" :aria-label="`${content.minimapLabel}, ${content.zoomLabel}: ${zoomPercent}%`">
            <svg class="bs-hq-layout__minimap-scene" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <defs><clipPath :id="islandClipId"><polygon :points="islandMapOutline" /></clipPath></defs>
              <polygon class="bs-hq-layout__map-floor" :points="islandMapOutline" />
              <polygon v-if="groundFootprint" class="bs-hq-layout__map-footprint" :points="groundFootprint" :clip-path="`url(#${islandClipId})`" />
              <polyline v-for="office in mapOffices" :key="`${office.id}-road`" class="bs-hq-layout__map-road" :points="office.road" />
              <polygon v-for="office in mapOffices" :key="office.id" class="bs-hq-layout__office-marker" :class="{ 'bs-hq-layout__office-marker--executive': office.executive, 'bs-hq-layout__office-marker--selected': selectedWorkplaceId === office.id }" :points="office.points"><title>{{ office.name }}</title></polygon>
              <polygon class="bs-hq-layout__minimap-view" :points="screenRectangle" />
            </svg>
            <span class="bs-hq-layout__orb-marker" style="left: 50%; top: 50%" aria-hidden="true"><BsIcon name="orb" :size="18" /></span>
            <span class="bs-hq-layout__zoom-value" :aria-label="content.zoomLabel">{{ zoomPercent }}%</span>
          </div>
          <div class="bs-hq-layout__zoom">
            <BsButton variant="icon" :aria-label="content.zoomOutLabel" :disabled="!canZoomOut" @click="zoomBy(1 / 1.2)"><BsIcon name="minus" :size="21" /></BsButton>
            <BsButton variant="icon" :aria-label="content.zoomInLabel" :disabled="!canZoomIn" @click="zoomBy(1.2)"><BsIcon name="add" :size="21" /></BsButton>
            <BsButton variant="icon" :aria-label="content.fitViewLabel" :title="content.fitViewLabel" @click="resetScene"><BsIcon name="repeat" :size="21" /></BsButton>
          </div>
        </aside>
      </div>
    </section>
    <Transition name="bs-hq-brain-slide" @after-leave="brainPanelPresent = brainVisible">
    <aside v-if="brainVisible" :id="brainPanelId" class="bs-hq-glass-panel bs-hq-layout__brain-panel" :class="{ 'bs-hq-layout__panel--covered': chatVisible || conversationDetail || coverPrimary }" :inert="chatVisible || conversationDetail || coverPrimary ? true : undefined" :aria-labelledby="brainTitleId" @wheel.stop @keydown.esc.stop.prevent="recordDetail ? closeRecord() : closeBrain()">
      <header class="bs-hq-layout__brain-heading">
        <h2 :id="brainTitleId" ref="panelTitleRef" tabindex="-1">{{ brainCopy.title }}</h2>
        <div class="bs-hq-layout__panel-actions">
          <BsButton v-if="brainTab === 'notes'" :pending="brain?.refreshing" :disabled="brainStatus === 'loading'" @click="emit('refreshBrain')" variant="icon" :aria-label="brainCopy.refreshLabel" :title="brainCopy.refreshLabel"><BsIcon name="refresh" :size="18" /></BsButton>
          <BsButton variant="icon" :aria-label="ui('close')" @click="closeBrain()"><BsIcon name="close" :size="20" /></BsButton>
        </div>
      </header>
      <BsTabs v-if="brainTabs.length > 1" variant="hq" class="bs-hq-layout__office-tabs" :model-value="brainTab" :tabs="brainTabs" :label="brainCopy.title" :id-prefix="brainTabsId" @update:model-value="selectBrainTab" />
      <div :id="`${brainTabsId}-panel`" :key="brainTab" class="bs-hq-layout__panel-scroll bs-hq-layout__office-content" :role="brainTabs.length > 1 ? 'tabpanel' : undefined" :aria-labelledby="brainTabs.length > 1 ? `${brainTabsId}-${brainTab}` : undefined" tabindex="0">
        <section v-if="brainTab === 'notes'" class="bs-hq-brain" :aria-label="brainCopy.title">
          <div class="bs-hq-brain__source">
            <div><strong role="status">{{ brainStatusLabel }}</strong><p>{{ brainCopy.sourceLabel }} · {{ brainCopy.readOnlyLabel }}</p><p>{{ brainCopy.freshnessLabel }}</p><small v-if="brain?.observedLabel">{{ brainCopy.observedLabel }}: {{ brain.observedLabel }}</small></div>
          </div>
          <p v-if="brain?.reason === 'not-configured' || brain?.reason === 'authorization-required'" role="status">{{ brainCopy.setupInstructionsLabel }}</p>
          <p v-if="brain?.partial" role="status">{{ brainCopy.partialLabel }}</p>
          <div v-if="brainStatus === 'connected'" class="bs-hq-brain__body">
            <nav class="bs-hq-brain__directory" :aria-label="brainCopy.searchLabel">
              <BsInput v-model="search" type="search" :aria-label="brainCopy.searchLabel" :placeholder="brainCopy.searchLabel" />
              <p v-if="!visibleNotes.length" role="status">{{ brainCopy.emptyLabel }}</p>
              <ul v-else><li v-for="note in renderedNotes" :key="note.id"><BsButton variant="tile" align="start" :aria-pressed="recordDetail?.kind === 'note' && recordDetail.id === note.id" @click="openRecord('note', note.id, note.title)"><strong>{{ note.title }}</strong><small dir="auto">{{ note.path }}</small></BsButton></li></ul>
              <BsButton v-if="renderedNotes.length < visibleNotes.length" variant="secondary" @click="noteLimit += 40">{{ brainCopy.showMoreLabel }}</BsButton>
            </nav>
          </div>
        </section>
        <template v-else>
          <BsHqWorkforce v-if="founderAccess.status === 'founder' && content.agents?.workforce" section="learning" browse-only :presentation="agentsState" :content="content.agents.workforce" :locale="content.agents.locale" @open-learning="openRecord('lesson', $event)" @refresh="emit('refreshAgents')" />
          <BsHqCompanyPlans v-else hide-header :copy="content.companyPlans" :access="founderAccess" :workspace="plansWorkspace" @login="(email, password) => emit('login', email, password)" @register="(email, password) => emit('register', email, password)" @logout="emit('logout')" />
        </template>
      </div>
    </aside>
    </Transition>
    <Transition name="bs-hq-brain-slide" @after-leave="workplacePanelPresent = workplaceVisible">
      <aside v-if="selectedWorkplace" :id="workplacePanelId" class="bs-hq-glass-panel bs-hq-layout__brain-panel bs-hq-layout__workplace-panel" :class="{ 'bs-hq-layout__workplace-panel--behind': selectedAgent, 'bs-hq-layout__panel--covered': chatVisible || conversationDetail || coverPrimary }" :inert="chatVisible || conversationDetail || coverPrimary || selectedAgent && viewportSize.width <= 1250 ? true : undefined" :aria-labelledby="workplaceTitleId" @wheel.stop @keydown.esc.stop.prevent="recordDetail ? closeRecord() : selectedAgent ? closeAgentPanel() : closeSelection()">
        <header class="bs-hq-layout__brain-heading">
          <h2 :id="workplaceTitleId" ref="workplaceTitleRef" tabindex="-1">{{ selectedWorkplace.name }}</h2>
          <div class="bs-hq-layout__panel-actions">
            <BsButton v-if="officeCopy && founderAccess.status === 'founder'" variant="icon" :disabled="agentsState.pending" :aria-label="officeCopy.retry" :title="officeCopy.retry" @click="emit('refreshAgents')"><BsIcon name="refresh" :size="18" /></BsButton>
          <BsButton variant="icon" :aria-label="ui('close')" @click="closeSelection()"><BsIcon name="close" :size="20" /></BsButton>
          </div>
        </header>
        <template v-if="officeCopy">
          <p class="bs-hq-layout__workplace-description">{{ officeRosterKnown ? selectedWorkplaceAgents.length : '—' }} · {{ officeCopy.agents }}</p>
          <BsTabs variant="hq" class="bs-hq-layout__office-tabs" :model-value="officeSection" :tabs="officeTabs" :label="selectedWorkplace.name" :id-prefix="officeTabsId" @update:model-value="selectSection" />
          <div :id="`${officeTabsId}-panel`" class="bs-hq-layout__office-content bs-hq-layout__panel-scroll" role="tabpanel" :aria-labelledby="`${officeTabsId}-${officeSection}`" tabindex="0">
            <template v-if="founderAccess.status !== 'founder' && (officeSection === 'overview' || officeSection === 'tasks')"><BsHqCompanyPlans :copy="content.companyPlans" :access="founderAccess" :workspace="plansWorkspace" :departments="departments" @login="(email,password) => emit('login',email,password)" @register="(email,password) => emit('register',email,password)" /></template>
            <template v-else-if="officeSection === 'overview'">
              <p v-if="agentsState.pending" class="bs-hq-layout__workplace-description" role="status">{{ officeCopy.loading }}</p>
              <BsHqOfficeOverview :agents="selectedWorkplaceAgents" :observations="officeRosterKnown ? agentsState.observations : undefined" :copy="officeCopy" :locale="content.agents?.locale" :tasks="agentsState.officeTasks" @select-agent="openAgent" />
            </template>
            <section v-else-if="officeSection === 'tasks'" class="bs-hq-layout__office-tasks">
              <BsHqTaskBrowser v-if="agentsState.status === 'connected' && taskSource && content.agents?.workforce?.taskBrowser && officeRosterKnown" :key="selectedWorkplace.id" :source="taskSource" :revision="agentsState.taskBrowserRevision" :copy="content.agents.workforce.taskBrowser" :agents="agentsState.agents" :office-id="selectedWorkplace.executive ? 'executive' : selectedWorkplace.id" :locale="content.agents.locale" @select="openRecord('task', $event.id, $event.title)" />
              <p v-else role="status">{{ officeCopy.unavailable }}</p>
            </section>
            <!-- Calendar and Settings intentionally remain empty, selectable panels. -->
          </div>
        </template>
        <section v-else class="bs-hq-layout__workplace-details bs-hq-layout__panel-scroll" :aria-label="selectedWorkplace.name">
          <dl><div><dt>{{ content.workplaces.workstationsLabel }}</dt><dd>{{ selectedWorkplaceAgents?.length ?? content.workplaces.workstationsValue }}</dd></div></dl>
          <p>{{ content.workplaces.agentsSpaceLabel }}</p>
          <ul v-if="selectedWorkplaceAgents"><li v-for="agent in selectedWorkplaceAgents" :key="agent.id"><strong>{{ agent.name }}</strong><span v-if="agent.roleLabel"> · {{ agent.roleLabel }}</span><p v-if="agent.connectionLabel || agent.activityLabel">{{ agent.connectionLabel ?? agent.activityLabel }}</p></li></ul>
          <p class="bs-hq-layout__workplace-description">{{ content.workplaces.workspaceReadyLabel }}</p>
        </section>
      </aside>
    </Transition>
    <Transition name="bs-hq-brain-slide">
      <aside v-if="selectedAgent && officeCopy" :id="agentPanelId" class="bs-hq-glass-panel bs-hq-layout__brain-panel bs-hq-layout__agent-panel" :class="{ 'bs-hq-layout__agent-panel--team': teamVisible, 'bs-hq-layout__panel--covered': !teamVisible && (chatVisible || conversationDetail || recordDetail) }" :inert="!teamVisible && (chatVisible || conversationDetail || recordDetail) ? true : undefined" :aria-labelledby="agentTitleId" @wheel.stop @keydown.esc.stop.prevent="closeAgentPanel">
        <header class="bs-hq-layout__brain-heading"><div><h2 :id="agentTitleId" ref="agentTitleRef" tabindex="-1" dir="auto">{{ selectedAgent.name }}</h2><p class="bs-hq-layout__workplace-description">{{ selectedAgent.roleLabel }} · <bdi>{{ selectedAgent.id }}</bdi></p></div><BsButton variant="icon" :aria-label="officeCopy.close" @click="closeAgentPanel"><BsIcon name="close" :size="20" /></BsButton></header>
        <div class="bs-hq-layout__panel-scroll">
        <BsHqOfficeOverview :agents="[selectedAgent]" :observations="agentsState.observations" :copy="officeCopy" :locale="content.agents?.locale" :tasks="agentsState.officeTasks" detail />
        <template v-if="founderAccess.status === 'founder' && selectedTrial">
          <section v-if="selectedAgent.id === 'AG-RES-002'" aria-label="Public Research qualification">
            <h3>Public Research qualification</h3>
            <p v-if="!selectedResearchTrial" role="status">Public Research status unavailable. Refresh to check eligibility.</p>
            <template v-else>
              <p role="status">{{ selectedResearchTrial.qualified ? 'Public Research tool qualified' : selectedResearchTrial.status === 'active' ? 'Public Research trial in progress' : selectedResearchTrial.reviewComplete && selectedResearchTrial.bindingCurrent && !selectedResearchTrial.receiptIssued ? 'Reviewed Public Research trial ready for qualification' : selectedResearchTrial.trialId && !selectedResearchTrial.bindingCurrent ? 'Earlier Public Research evidence is not current; a new trial is required' : selectedResearchTrial.status ? `Public Research trial: ${selectedResearchTrial.status}` : selectedResearchTrial.eligible ? 'Public Research trial available' : 'Public Research trial currently unavailable' }}</p>
              <p>One fixed generic public search, up to three results. No private task text, outreach or automatic qualification.</p>
              <BsButton v-if="selectedResearchTrial.eligible && selectedResearchTrial.skillFileId && !selectedResearchTrial.qualified && selectedResearchTrial.status !== 'active' && !(selectedResearchTrial.reviewComplete && selectedResearchTrial.bindingCurrent && !selectedResearchTrial.receiptIssued)" :disabled="trialConfirming || agentsState.trialPending" @click="trialAction({ action: 'start-public-research', skillFileId: selectedResearchTrial.skillFileId })">Start Public Research trial</BsButton>
              <BsButton v-if="selectedResearchTrial.reviewComplete && selectedResearchTrial.bindingCurrent && selectedResearchTrial.trialId && !selectedResearchTrial.receiptIssued && !selectedResearchTrial.qualified" :disabled="trialConfirming || agentsState.trialPending" @click="trialAction({ action: 'qualify-public-research', trialId: selectedResearchTrial.trialId })">Approve Public Research qualification</BsButton>
            </template>
          </section>
          <section v-if="selectedRetailTrial" aria-label="Public Retail qualification">
            <h3>Public Retail qualification</h3>
            <p role="status">{{ selectedRetailTrial.qualified ? 'Public Retail tool qualified for the approved finite policy' : selectedRetailTrial.status === 'active' ? 'Public Retail trial in progress' : selectedRetailTrial.reviewComplete && selectedRetailTrial.bindingCurrent && !selectedRetailTrial.receiptIssued ? 'Reviewed Public Retail trial ready for qualification' : selectedRetailTrial.trialId && !selectedRetailTrial.bindingCurrent ? 'Earlier Public Retail evidence is not current' : selectedRetailTrial.eligible ? 'Public Retail trial available' : 'Public Retail setup or current qualification prerequisites are not ready' }}</p>
            <p v-if="selectedRetailTrial.lastCategory">Actual latest trial category: {{ selectedRetailTrial.lastCategory }}. Other category results are not implied.</p>
            <template v-if="selectedRetailTrial.eligible && selectedRetailTrial.skillFileId && !selectedRetailTrial.qualified && selectedRetailTrial.status !== 'active' && !(selectedRetailTrial.reviewComplete && selectedRetailTrial.bindingCurrent && !selectedRetailTrial.receiptIssued)">
              <BsSelect :model-value="retailCategory" :options="[...selectedRetailTrial.categories]" label="Fixed New Cairo shop category" :disabled="trialConfirming || agentsState.trialPending" append-to="self" @update:model-value="chooseRetailCategory" />
              <BsButton :disabled="trialConfirming || agentsState.trialPending || !selectedRetailTrial.categories.includes(retailCategory)" @click="trialAction({ action: 'start-public-retail', skillFileId: selectedRetailTrial.skillFileId, category: retailCategory })">Start Public Retail trial</BsButton>
            </template>
            <BsButton v-if="selectedRetailTrial.reviewComplete && selectedRetailTrial.bindingCurrent && selectedRetailTrial.trialId && !selectedRetailTrial.receiptIssued && !selectedRetailTrial.qualified" :disabled="trialConfirming || agentsState.trialPending" @click="trialAction({ action: 'qualify-public-retail', trialId: selectedRetailTrial.trialId })">Approve Public Retail qualification</BsButton>
          </section>
          <section v-if="selectedOrdinaryTrial" aria-label="Assigned-skill qualification">
            <h3>Assigned-skill qualification</h3>
            <p v-if="selectedOrdinaryTrial.skillName">Selected skill: {{ selectedOrdinaryTrial.skillName }}</p>
            <p v-if="selectedOrdinaryTrial.reviewerId">Independent reviewer: {{ agentsState.agents.find(agent => agent.id === selectedOrdinaryTrial?.reviewerId)?.name ?? selectedOrdinaryTrial.reviewerId }}</p>
            <p role="status">{{ selectedOrdinaryTrial.qualified ? 'Qualified for bounded drafting' : selectedOrdinaryTrial.status === 'active' ? 'Assigned-skill trial in progress' : selectedOrdinaryTrial.reviewComplete && selectedOrdinaryTrial.bindingCurrent && !selectedOrdinaryTrial.receiptIssued ? 'Reviewed assigned-skill trial ready for qualification' : selectedOrdinaryTrial.trialId && !selectedOrdinaryTrial.bindingCurrent ? 'Earlier assigned-skill evidence is not current' : selectedOrdinaryTrial.eligible && selectedOrdinaryTrial.reviewerReady ? 'Assigned-skill trial available' : 'Assigned-skill trial prerequisites are not ready' }}</p>
            <BsButton v-if="selectedOrdinaryTrial.eligible && selectedOrdinaryTrial.reviewerReady && selectedOrdinaryTrial.skillFileId && !selectedOrdinaryTrial.qualified && selectedOrdinaryTrial.status !== 'active' && !(selectedOrdinaryTrial.reviewComplete && selectedOrdinaryTrial.bindingCurrent && !selectedOrdinaryTrial.receiptIssued)" :disabled="trialConfirming || agentsState.trialPending" @click="trialAction({ action: 'start-skill-trial', agentId: selectedAgent.id, skillFileId: selectedOrdinaryTrial.skillFileId })">Start assigned-skill trial</BsButton>
            <BsButton v-if="selectedOrdinaryTrial.reviewComplete && selectedOrdinaryTrial.bindingCurrent && selectedOrdinaryTrial.reviewerReady && selectedOrdinaryTrial.trialId && !selectedOrdinaryTrial.receiptIssued" :disabled="trialConfirming || agentsState.trialPending" @click="trialAction({ action: 'qualify', agentId: selectedAgent.id, trialId: selectedOrdinaryTrial.trialId })">Approve assigned-skill qualification</BsButton>
          </section>
          <p v-if="!selectedOrdinaryTrial && !publicTrialIsLatest && selectedRetailTrial?.trialId !== selectedTrial.trialId" role="status">{{ selectedTrial.qualified ? 'Qualified for bounded drafting' : selectedTrial.receiptIssued ? selectedTrial.skillFileId ? 'Skill qualification recorded; remaining assigned skills require trials' : 'Qualification recorded; canonical Active lifecycle required' : selectedTrial.status ? `Supervised trial: ${selectedTrial.status}` : 'Supervised trial required' }}</p>
          <BsButton v-if="!selectedOrdinaryTrial && !publicTrialIsLatest && selectedRetailTrial?.trialId !== selectedTrial.trialId && selectedTrial.reviewComplete && selectedTrial.trialId && !selectedTrial.receiptIssued" :disabled="trialConfirming || agentsState.trialPending" @click="trialAction({ action: 'qualify', trialId: selectedTrial.trialId })">Approve qualification</BsButton>
          <p v-if="agentsState.trialMessage && agentsState.trialMessageAgentId === selectedAgent.id" role="status">{{ agentsState.trialMessage }}</p>
        </template>
        </div>
      </aside>
    </Transition>
    <Transition name="bs-hq-brain-slide">
      <aside v-if="chatVisible" :id="chatPanelId" class="bs-hq-glass-panel bs-hq-layout__brain-panel bs-hq-layout__chat-panel" :class="{ 'bs-hq-layout__chat-panel--behind': coverPrimary }" :inert="coverPrimary ? true : undefined" :aria-labelledby="chatTitleId" @wheel.stop @keydown.esc.stop.prevent="recordDetail ? closeRecord() : closeConversation()">
        <header class="bs-hq-layout__brain-heading"><h2 :id="chatTitleId" ref="chatTitleRef" tabindex="-1">{{ content.talkToCeoLabel }}</h2><BsButton variant="icon" :aria-label="ui('close')" @click="closeConversation()"><BsIcon name="close" :size="20" /></BsButton></header>
        <BsHqCeoChat v-if="founderAccess.status === 'founder' && content.agents" v-model:draft="chatDraft" :presentation="agentsState" :content="content.agents" @send="emit('sendCeoMessage', $event)" @refresh="emit('refreshAgents')" @open-task="openRecord('task', $event)" @open-learning="openRecord('lesson', $event)" />
        <BsHqCompanyPlans v-else class="bs-hq-layout__panel-scroll" :copy="content.companyPlans" :access="founderAccess" :workspace="plansWorkspace" :departments="departments" @login="(email, password) => emit('login', email, password)" @register="(email, password) => emit('register', email, password)" />
      </aside>
    </Transition>
    <Transition name="bs-hq-brain-slide">
      <aside v-if="conversationDetail && sidebarTitle" :key="conversationDetail" :id="conversationDetailPanelId" class="bs-hq-glass-panel bs-hq-layout__brain-panel bs-hq-layout__conversation-detail" :class="{ 'bs-hq-layout__top-panel': plansVisible || teamVisible, 'bs-hq-layout__team-panel': teamVisible, 'bs-hq-layout__panel--covered': coverPrimary || teamVisible && selectedAgent && viewportSize.width <= 760 }" :inert="coverPrimary || teamVisible && selectedAgent && viewportSize.width <= 760 ? true : undefined" :aria-labelledby="conversationDetailTitleId" @wheel.stop @keydown.esc.stop.prevent="recordDetail ? closeRecord() : teamVisible && selectedAgent ? closeAgentPanel() : closeConversationDetail()">
        <header v-if="!teamVisible" class="bs-hq-layout__brain-heading">
          <h2 :id="conversationDetailTitleId" ref="conversationDetailTitleRef" tabindex="-1">{{ sidebarTitle }}</h2>
          <div class="bs-hq-layout__panel-actions">
            <BsButton v-if="plansVisible && founderAccess.status === 'founder'" variant="icon" :disabled="founderAccess.pending || plansWorkspace.pending || staffing?.pending" :aria-label="content.companyPlans.refreshLabel" :title="content.companyPlans.refreshLabel" @click="refreshPlanBoard"><BsIcon name="refresh" :size="18" /></BsButton>
            <BsButton variant="icon" :aria-label="ui('close')" @click="closeConversationDetail()"><BsIcon name="close" :size="20" /></BsButton>
          </div>
        </header>
        <h2 v-else :id="conversationDetailTitleId" ref="conversationDetailTitleRef" tabindex="-1" class="bs-hq-layout__team-accessible-title">{{ sidebarTitle }}</h2>
        <BsHqTeamChart v-if="teamVisible && content.agents?.workforce && officeCopy" @close="closeConversationDetail" :chart-label="content.agents.workforce.orgChartLabel ?? 'Org Chart'" :controls="content.agents.workforce.orgChartControls" :unassigned-label="content.agents.workforce.unassignedDepartmentLabel ?? content.agents.workforce.departmentLabel" :empty-label="content.agents.workforce.emptyTeamLabel" :refresh-label="content.agents.workforce.refreshLabel" :presentation="agentsState" :copy="officeCopy" :locale="content.agents.locale" :founder="founderAccess.status === 'founder'" @refresh="emit('refreshAgents')" @select-employee="openTeamAgent">
          <template #access>
            <BsHqCompanyPlans hide-header :copy="content.companyPlans" :access="founderAccess" :workspace="plansWorkspace" :departments="departments" @login="(email, password) => emit('login', email, password)" @register="(email, password) => emit('register', email, password)" />
          </template>
        </BsHqTeamChart>
        <div v-else class="bs-hq-layout__panel-scroll">
          <p v-if="plansVisible && founderAccess.status === 'founder' && founderAccess.message" role="alert">{{ founderAccess.message }}</p>
          <BsHqPlanBoard v-if="plansVisible && founderAccess.status === 'founder'" :copy="content.companyPlans" :workspace="plansWorkspace" :staffing="staffing" :staffing-copy="staffingCopy" @open="openRecord" />
          <BsHqWorkforce v-else-if="conversationDetail === 'tasks' && founderAccess.status === 'founder' && content.agents?.workforce" section="tasks" browse-only @open-task="(id, title) => openRecord('task', id, title)" :presentation="agentsState" :content="content.agents.workforce" :locale="content.agents.locale" @refresh="emit('refreshAgents')" />
          <BsHqCompanyPlans v-else hide-header :copy="content.companyPlans" :access="founderAccess" :workspace="plansWorkspace" @login="(email, password) => emit('login', email, password)" @register="(email, password) => emit('register', email, password)" @logout="emit('logout')" />
        </div>
      </aside>
    </Transition>
    <Transition name="bs-hq-brain-slide">
      <aside v-if="recordDetail" class="bs-hq-glass-panel bs-hq-layout__brain-panel bs-hq-layout__record-panel" :class="{ 'bs-hq-layout__record-panel--plans': plansVisible }" :aria-labelledby="recordTitleId" @wheel.stop @keydown.esc.stop.prevent="closeRecord()">
        <header class="bs-hq-layout__brain-heading"><h2 :id="recordTitleId" ref="recordTitleRef" tabindex="-1" dir="auto">{{ recordTitle }}</h2><BsButton variant="icon" :aria-label="ui('close')" @click="closeRecord()"><BsIcon name="close" :size="20" /></BsButton></header>
        <div class="bs-hq-layout__panel-scroll" :key="`${recordDetail.kind}:${recordDetail.id}`">
          <article v-if="recordDetail.kind === 'note'" class="bs-hq-brain__note" :aria-busy="brain?.noteStatus === 'loading'" aria-live="polite">
            <p v-if="brain?.noteStatus === 'loading'">{{ brainCopy.loadingLabel }}</p>
            <p v-else-if="brain?.noteStatus === 'error' || !selectedNote" role="status">{{ brainCopy.noteErrorLabel }}</p>
            <template v-else><p dir="auto">{{ selectedNote.path }}</p><small>{{ brainCopy.modifiedLabel }}: {{ selectedNote.modifiedLabel }} · {{ brainCopy.versionLabel }}: {{ selectedNote.version }}</small><pre dir="auto">{{ selectedNote.content }}</pre></template>
          </article>
          <template v-else-if="founderAccess.status === 'founder'">
            <BsHqWorkforce v-if="content.agents?.workforce && (recordDetail.kind === 'task' || recordDetail.kind === 'lesson')" detail-only :section="recordDetail.kind === 'task' ? 'tasks' : 'learning'" :selected-task-id="recordDetail.kind === 'task' ? recordDetail.id : null" :selected-lesson-id="recordDetail.kind === 'lesson' ? recordDetail.id : null" :presentation="agentsState" :content="content.agents.workforce" :locale="content.agents.locale" />
            <BsHqCompanyPlans v-else-if="recordDetail.kind === 'plan'" separate-details hide-header :selected-plan-id="recordDetail.id" :copy="content.companyPlans" :access="founderAccess" :workspace="plansWorkspace" :departments="departments" @refresh="emit('refreshPlans')" @decision="(id, revision, decision) => emit('decidePlan', id, revision, decision)" />
            <BsHqStaffingPlans v-else-if="recordDetail.kind === 'staffing' && staffing && staffingCopy" separate-details :selected-workflow-id="recordDetail.id" :presentation="staffing" :copy="staffingCopy" :founder="!founderAccess.pending" @refresh="emit('refreshStaffing')" @decision="emit('staffingDecision', $event)" @cancel="emit('staffingCancel', $event)" />
          </template>
          <BsHqCompanyPlans v-else hide-header :copy="content.companyPlans" :access="founderAccess" :workspace="plansWorkspace" @login="(email, password) => emit('login', email, password)" @register="(email, password) => emit('register', email, password)" />
        </div>
      </aside>
    </Transition>
    </main>
    <BsHqMeetingPanel v-if="meeting" v-model:visible="meetingVisible" :meeting="meeting" :chat-only-work="meeting.mode !== 'demonstration'" @command="command => emit('meetingCommand', command)" />
  </div>
</template>

<style scoped>
.bs-hq-layout {
  color-scheme: dark;
  display: flex;
  height: 100svh;
  min-height: 360px;
  padding: var(--bs-space-2);
  overflow: hidden;
  color: var(--bs-pearl-white);
  background: linear-gradient(145deg, var(--bs-color-brand-deep-structure-navy), var(--bs-color-neutral-ink) 70%);
  font-family: var(--bs-font-latin);
}
.bs-hq-layout__workspace-area { position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(0, 1fr); flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
.bs-hq-layout__canvas {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 12%, transparent);
  border-radius: 22px;
  background: radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--bs-color-brand-building-navy) 58%, transparent), transparent 64%), linear-gradient(155deg, var(--bs-color-brand-deep-structure-navy), var(--bs-color-neutral-charcoal) 52%, var(--bs-color-neutral-ink));
  box-shadow: inset 0 1px 1px color-mix(in srgb, var(--bs-pearl-white) 10%, transparent), inset 0 0 60px color-mix(in srgb, var(--bs-color-brand-building-navy) 12%, transparent);
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.bs-hq-layout__canvas--orb-hovered { cursor: pointer; }
.bs-hq-layout__canvas--interacting { cursor: grabbing; }
.bs-hq-layout__canvas:focus-visible { outline: 2px solid var(--bs-premium-gold); outline-offset: -4px; }
.bs-hq-layout__brand { position: absolute; z-index: 2; inset-block-start: 18px; inset-inline-start: 20px; display: flex; align-items: center; gap: 11px; max-width: calc(50% - 28px); cursor: default; }
.bs-hq-layout__brand img { flex: none; width: 32px; height: 44px; object-fit: contain; }
.bs-hq-layout__brand h1 { margin: 0; font-size: 21px; font-weight: 650; line-height: 1.2; letter-spacing: -.5px; white-space: nowrap; }
.bs-hq-layout__brand h1 span { color: var(--bs-premium-gold); }
.bs-hq-layout__navigation { position: absolute; z-index: 4; top: 18px; left: 50%; transform: translateX(-50%); width: max-content; max-width: calc(100% - 32px); cursor: default; }
.bs-hq-layout__workplace-picker { position: relative; display: flex; align-items: center; flex: 0 1 190px; width: 190px; min-width: 120px; border: 1px solid transparent; border-inline-start-color: color-mix(in srgb, var(--bs-soft-silver) 16%, transparent); border-radius: 10px; }
.bs-hq-layout__workplace-picker--selected { border-color: color-mix(in srgb, var(--bs-premium-gold) 45%, transparent); background: var(--bs-color-brand-building-navy); }
.bs-hq-layout__workplace-picker :deep(.bs-select) { flex: 1; width: 0; min-width: 0; min-height: 36px; height: 36px; border: 0; border-radius: 9px; padding: 0; background: transparent; color: var(--bs-soft-silver); font: inherit; font-size: 13px; box-shadow: none; }
.bs-hq-layout__workplace-picker :deep(.bs-select-label) { padding-inline: 10px 4px; }
.bs-hq-layout__workplace-picker :deep(.bs-select-trigger) { min-width: 28px; min-height: 36px; }
.bs-hq-layout__workplace-picker :deep(.bs-select-overlay) { min-width: 190px; border-color: color-mix(in srgb, var(--bs-premium-gold) 30%, var(--bs-color-brand-building-navy)); background: var(--bs-color-neutral-charcoal); color: var(--bs-pearl-white); }
.bs-hq-layout__workplace-picker :deep(.bs-select-list-container) { overflow-y: auto; overscroll-behavior-y: contain; touch-action: pan-y; scrollbar-color: color-mix(in srgb, var(--bs-soft-silver) 55%, transparent) transparent; }
.bs-hq-layout__workplace-picker :deep(.bs-select-option[data-p-focused='true']) { background: var(--bs-color-brand-building-navy); }
.bs-hq-layout__workplace-picker :deep(.bs-select-option[aria-selected='true']) { background: var(--bs-premium-gold); color: var(--bs-color-neutral-ink); }
.bs-hq-layout .bs-hq-layout__workplace-clear { flex: none; width: 30px; min-height: 36px; padding: 5px; border: 0; background: transparent; color: var(--bs-soft-silver); }
.bs-hq-layout .bs-hq-layout__workplace-clear:hover { color: var(--bs-premium-gold); }
.bs-hq-layout__workplace-picker :deep(.bs-select:focus-visible), .bs-hq-layout__workplace-picker :deep(.bs-select[data-p-focused='true']), .bs-hq-layout__workplace-clear:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-layout__session { position: absolute; z-index: 2; inset-block-start: 18px; inset-inline-end: 20px; display: grid; gap: 7px; width: 204px; padding: 11px; border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 15%, var(--bs-color-brand-building-navy)); border-radius: 16px; background: linear-gradient(150deg, color-mix(in srgb, var(--bs-color-brand-building-navy) 60%, var(--bs-color-neutral-charcoal)), var(--bs-color-neutral-charcoal) 65%); box-shadow: inset 0 1px color-mix(in srgb, var(--bs-soft-silver) 7%, transparent), 0 4px 16px color-mix(in srgb, var(--bs-color-neutral-ink) 25%, transparent); cursor: default; }
.bs-hq-layout__status { display: flex; align-items: center; gap: 7px; min-height: 20px; color: var(--bs-soft-silver); font-size: 11px; line-height: 1.5; }
.bs-hq-layout__status > span { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--bs-color-neutral-steel-gray); }
.bs-hq-layout .bs-hq-layout__ceo { display: inline-flex; justify-content: center; gap: 7px; width: 100%; min-height: 34px; padding: 7px 9px; border: 1px solid var(--bs-premium-gold); border-radius: 9px; background: var(--bs-premium-gold); color: var(--bs-color-neutral-ink); font-size: 12px; font-weight: 650; line-height: 1.5; white-space: normal; }
.bs-hq-layout__account { display: flex; align-items: center; gap: 8px; min-width: 0; padding-top: 7px; border-top: 1px solid var(--bs-color-gray-800); }
.bs-hq-layout__avatar { flex: none; display: grid; place-items: center; width: 30px; height: 30px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--bs-premium-gold) 30%, transparent); border-radius: 50%; background: var(--bs-color-brand-building-navy); color: var(--bs-soft-silver); font-size: 11px; }
.bs-hq-layout__avatar img { width: 100%; height: 100%; object-fit: cover; }
.bs-hq-layout__identity { display: grid; gap: 2px; min-width: 0; text-align: start; }
.bs-hq-layout__identity strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; }
.bs-hq-layout__identity small { color: var(--bs-color-gray-400); font-size: 10px; overflow-wrap: anywhere; }
.bs-hq-layout .bs-hq-layout__login { display: flex; justify-content: center; gap: 7px; width: 100%; min-height: 32px; padding: 5px 8px; border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 15%, var(--bs-color-brand-building-navy)); border-radius: 9px; background: color-mix(in srgb, var(--bs-color-brand-deep-structure-navy) 60%, var(--bs-color-neutral-graphite)); color: var(--bs-soft-silver); font-size: 12px; }
.bs-hq-layout__tab:not(:disabled) { cursor: pointer; }
.bs-hq-layout__tab:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-layout__brain-panel { --bs-brain-panel-offset: calc(-100% - var(--bs-space-3)); position: absolute; z-index: 3; inset-block: 80px var(--bs-space-3); inset-inline-start: var(--bs-space-3); width: min(var(--bs-component-hq-glass-panel-width), calc(100% - var(--bs-space-6))); display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-y; padding: var(--bs-space-5); user-select: text; }
:global([dir="rtl"]) .bs-hq-layout__brain-panel { --bs-brain-panel-offset: calc(100% + var(--bs-space-3)); }
.bs-hq-brain-slide-enter-active, .bs-hq-brain-slide-leave-active { transition: transform 280ms cubic-bezier(.22, 1, .36, 1), opacity 200ms ease; will-change: transform; }
.bs-hq-brain-slide-enter-from, .bs-hq-brain-slide-leave-to { transform: translateX(var(--bs-brain-panel-offset)); opacity: 0; }
.bs-hq-layout__brain-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--bs-space-3); margin-bottom: var(--bs-space-5); }
.bs-hq-layout__brain-heading h2 { margin: 0; font-size: 19px; font-weight: 650; }
.bs-hq-layout__brain-heading h2:focus { outline: none; }
.bs-hq-layout__brain-heading button { flex: none; color: var(--bs-soft-silver); }
.bs-hq-layout__workplace-description { margin: 0 0 var(--bs-space-4); color: var(--bs-soft-silver); font-size: 13px; line-height: 1.7; }
.bs-hq-layout__workplace-subheading { margin: 0 0 var(--bs-space-4); font-size: 14px; font-weight: 600; }
.bs-hq-layout__workplace-details dl { margin: 0 0 var(--bs-space-4); }
.bs-hq-layout__workplace-details dl > div { display: flex; justify-content: space-between; gap: var(--bs-space-4); padding-block: var(--bs-space-4); border-block: 1px solid var(--bs-color-gray-800); }
.bs-hq-layout__workplace-details dt { color: var(--bs-soft-silver); }
.bs-hq-layout__workplace-details dd { margin: 0; color: var(--bs-premium-gold); font-weight: 600; }
.bs-hq-layout__workplace-details p { font-size: 13px; line-height: 1.7; }
.bs-hq-layout__brain-panel button:focus-visible, .bs-hq-layout__brain-panel input:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-brain { display: grid; gap: var(--bs-space-4); }
.bs-hq-brain__source { display: flex; align-items: start; justify-content: space-between; flex-wrap: wrap; gap: var(--bs-space-4); padding-bottom: var(--bs-space-4); border-bottom: 1px solid var(--bs-color-gray-800); font-size: 13px; line-height: 1.6; }
.bs-hq-brain__source p { margin: var(--bs-space-2) 0; color: var(--bs-soft-silver); font-size: 12px; }
.bs-hq-brain small { color: var(--bs-soft-silver); font-size: 11px; }
.bs-hq-brain__body { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--bs-space-5); }
.bs-hq-brain__directory { min-width: 0; }
.bs-hq-brain__directory input { color: var(--bs-pearl-white); background: color-mix(in srgb, var(--bs-color-brand-deep-structure-navy) 55%, var(--bs-color-neutral-graphite)); border-color: var(--bs-color-gray-800); }
.bs-hq-brain__directory input::placeholder { color: var(--bs-color-gray-400); }
.bs-hq-brain__directory ul { display: grid; gap: var(--bs-space-1); padding: 0; margin: var(--bs-space-3) 0 0; list-style: none; }
.bs-hq-brain__directory button { display: grid; width: 100%; min-width: 0; gap: var(--bs-space-1); padding: var(--bs-space-3); text-align: start; color: var(--bs-pearl-white); }
.bs-hq-brain__directory strong { font-size: 13px; font-weight: 600; }
.bs-hq-brain__directory small { overflow-wrap: anywhere; }
.bs-hq-brain__directory button:hover { background: color-mix(in srgb, var(--bs-color-brand-building-navy) 65%, var(--bs-color-neutral-graphite)); }
.bs-hq-brain__directory button[aria-pressed="true"] { background: var(--bs-color-brand-building-navy); border-inline-start: 2px solid var(--bs-premium-gold); }
.bs-hq-brain__note { min-width: 0; padding-top: var(--bs-space-4); border-top: 1px solid var(--bs-color-gray-800); user-select: text; }
.bs-hq-brain__note h2 { margin: 0 0 var(--bs-space-2); font-size: 18px; }
.bs-hq-brain__note p { margin: var(--bs-space-2) 0; overflow-wrap: anywhere; }
.bs-hq-brain__note pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 13px; line-height: 1.8; unicode-bidi: plaintext; }
.bs-hq-layout__footer { position: absolute; z-index: 2; inset: auto 0 0; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 16px; pointer-events: none; }
.bs-hq-layout__workspace-info { display: grid; min-width: 0; justify-items: start; gap: 8px; max-width: 340px; }
.bs-hq-layout__gesture-hint { margin: 0; color: var(--bs-soft-silver); opacity: .7; font-size: 10px; line-height: 1.6; }
.bs-hq-layout__touch-hint { display: none; }
.bs-hq-layout__keyboard-hint { display: block; }
.bs-hq-layout__view { display: flex; flex: none; flex-direction: column; align-items: center; gap: 10px; pointer-events: none; cursor: default; }
.bs-hq-layout__minimap { position: relative; width: 200px; height: 200px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 20%, transparent); border-radius: 50%; background: var(--bs-color-neutral-ink); box-shadow: 0 4px 14px color-mix(in srgb, var(--bs-color-neutral-ink) 25%, transparent); pointer-events: auto; }
.bs-hq-layout__minimap-scene { display: block; width: 100%; height: 100%; }
.bs-hq-layout__map-floor { fill: color-mix(in srgb, var(--bs-color-neutral-charcoal) 75%, var(--bs-color-brand-building-navy)); stroke: color-mix(in srgb, var(--bs-soft-silver) 20%, transparent); stroke-width: .6px; vector-effect: non-scaling-stroke; }
.bs-hq-layout__map-footprint { fill: color-mix(in srgb, var(--bs-soft-silver) 9%, transparent); stroke: color-mix(in srgb, var(--bs-soft-silver) 20%, transparent); stroke-width: .6px; stroke-dasharray: 2 2; vector-effect: non-scaling-stroke; }
.bs-hq-layout__map-road { fill: none; stroke: color-mix(in srgb, var(--bs-premium-gold) 65%, var(--bs-soft-silver)); stroke-width: 1px; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.bs-hq-layout__zoom-value { position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); padding: 1px 4px; border-radius: 4px; background: var(--bs-color-neutral-ink); color: var(--bs-soft-silver); font-size: 9px; line-height: 1.3; font-variant-numeric: tabular-nums; }
.bs-hq-layout__office-marker { fill: var(--bs-color-brand-building-navy); stroke: var(--bs-soft-silver); stroke-width: 1px; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.bs-hq-layout__office-marker--executive { fill: var(--bs-premium-gold); stroke: var(--bs-premium-gold); }
.bs-hq-layout__office-marker--selected { stroke: var(--bs-pearl-white); stroke-width: 2px; }
.bs-hq-layout__minimap-view { fill: none; stroke: color-mix(in srgb, var(--bs-soft-silver) 80%, transparent); stroke-width: 1px; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.bs-hq-layout__orb-marker { position: absolute; display: grid; place-items: center; width: 26px; height: 26px; transform: translate(-50%, -50%); border: 1px solid color-mix(in srgb, var(--bs-premium-gold) 50%, transparent); border-radius: 50%; color: var(--bs-premium-gold); background: var(--bs-color-brand-deep-structure-navy); box-shadow: 0 0 14px color-mix(in srgb, var(--bs-premium-gold) 18%, transparent); }
.bs-hq-layout__zoom { display: grid; grid-template-columns: repeat(3, 36px); gap: 2px; padding: 4px; border: 1px solid color-mix(in srgb, var(--bs-soft-silver) 16%, var(--bs-color-brand-building-navy)); border-radius: 14px; background: linear-gradient(135deg, var(--bs-color-brand-deep-structure-navy), var(--bs-color-neutral-charcoal)); pointer-events: auto; }
.bs-hq-layout .bs-hq-layout__zoom button { width: 36px; min-width: 0; height: 36px; padding: 0; border: 1px solid transparent; border-radius: 9px; background: transparent; color: var(--bs-soft-silver); }
.bs-hq-layout button:disabled { opacity: 1; cursor: default; }
.bs-hq-layout .bs-hq-layout__zoom button:not(:disabled) { cursor: pointer; }
.bs-hq-layout .bs-hq-layout__zoom button:not(:disabled):hover { background: var(--bs-color-brand-building-navy); border-color: var(--bs-premium-gold); color: var(--bs-pearl-white); }
.bs-hq-layout .bs-hq-layout__zoom button:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-layout .bs-hq-layout__zoom button:disabled { opacity: .4; }
:global([dir="rtl"]) .bs-hq-layout { font-family: var(--bs-font-arabic); }
:global([dir="rtl"]) .bs-hq-layout__brand h1 { letter-spacing: normal; }
:global([dir="rtl"]) .bs-hq-layout__workspace-area--brain .bs-hq-layout__footer { flex-direction: row-reverse; }
/* Canonical HQ glass tokens keep every overlay translucent without dimming text. */
.bs-hq-layout { --bs-component-card-dark-background: var(--bs-component-hq-glass-card); --bs-component-card-light-background: var(--bs-component-hq-glass-card); }
.bs-hq-layout__navigation,.bs-hq-layout__session,.bs-hq-layout__zoom,.bs-hq-layout__minimap {
  background: var(--bs-component-hq-glass-panel); border-color: var(--bs-component-hq-glass-border);
  backdrop-filter: blur(var(--bs-component-hq-glass-blur)); -webkit-backdrop-filter: blur(var(--bs-component-hq-glass-blur));
}
.bs-hq-layout__brain-panel { overflow: hidden; }
.bs-hq-layout .bs-hq-layout__tab--selected,.bs-hq-layout__workplace-picker--selected,.bs-hq-layout__orb-marker { background: var(--bs-component-hq-glass-selected); }
.bs-hq-layout .bs-hq-layout__login,.bs-hq-layout__avatar,.bs-hq-layout__zoom-value { background: var(--bs-component-hq-glass-control); }
.bs-hq-layout__workplace-picker :deep(.bs-select-overlay) { background: var(--bs-component-hq-glass-panel); backdrop-filter: blur(var(--bs-component-hq-glass-blur)); }
.bs-hq-layout__map-floor { fill: var(--bs-component-hq-glass-selected); }
.bs-hq-layout__brain-panel:not(.bs-hq-layout__team-panel) :deep(article),.bs-hq-layout__brain-panel:not(.bs-hq-layout__team-panel) :deep(.bs-card),.bs-hq-layout__brain-panel:not(.bs-hq-layout__team-panel) :deep(.ls-card) { background-color: var(--bs-component-hq-glass-card); }
.bs-hq-layout__office-tabs { flex: none; flex-wrap: wrap; margin-block-end: var(--bs-space-3); }
.bs-hq-layout__office-tabs :deep(.ls-action-tab) { padding-inline: var(--bs-space-2); }
.bs-hq-layout__office-content { outline-offset: -2px; }
.bs-hq-layout__office-tasks { display: grid; gap: var(--bs-space-4); font-size: .8rem; line-height: 1.8; }
.bs-hq-layout__office-tasks article { padding: var(--bs-space-4); border: 1px solid var(--bs-component-hq-glass-border); border-radius: var(--bs-radius-card); background: var(--bs-component-hq-glass-card); }
.bs-hq-layout__office-tasks h3 { margin: 0; font-size: .9rem; }.bs-hq-layout__office-tasks p { white-space: pre-wrap; overflow-wrap: anywhere; }
.bs-hq-layout__agent-panel .bs-hq-layout__brain-heading { align-items: start; }
.bs-hq-layout__agent-panel .bs-hq-layout__workplace-description { margin-block: var(--bs-space-2) 0; font-size: .75rem; }
.bs-hq-layout__panel--covered { visibility: hidden; pointer-events: none; }
.bs-hq-layout__chat-panel { z-index: 6; overflow: hidden; }
.bs-hq-layout__chat-panel > .bs-hq-layout__brain-heading { flex: none; margin-block-end: var(--bs-space-3); }
.bs-hq-layout__chat-panel :deep(.bs-hq-chat) { flex: 1; min-height: 0; }
.bs-hq-layout__conversation-detail { z-index: 7; }
.bs-hq-layout__brain-heading { flex: none; }
.bs-hq-layout__panel-actions { display: flex; flex: none; gap: var(--bs-space-1); }
.bs-hq-layout__panel-scroll { flex: 1; min-height: 0; min-width: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
.bs-hq-layout__agent-panel, .bs-hq-layout__record-panel {
  --hq-parent-width: var(--bs-component-hq-glass-panel-width);
  z-index: 9;
  inset-inline-start: calc(var(--hq-parent-width) + var(--bs-space-6));
  width: min(max(var(--bs-component-hq-glass-plans-width), var(--bs-component-hq-glass-detail-width)), calc(100% - var(--hq-parent-width) - var(--bs-space-6) - var(--bs-space-3)));
}
.bs-hq-layout__top-panel.bs-hq-glass-panel {
  inset-inline: 0;
  width: 85%;
  margin-inline: auto;
}
.bs-hq-layout__team-panel.bs-hq-glass-panel { padding: 0; }
.bs-hq-layout__team-accessible-title { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.bs-hq-layout__agent-panel--team { inset-inline-start: var(--bs-space-3); width: min(var(--bs-component-hq-glass-panel-width), calc(100% - var(--bs-space-6))); }
.bs-hq-layout__top-panel.bs-hq-brain-slide-enter-from,
.bs-hq-layout__top-panel.bs-hq-brain-slide-leave-to { transform: translateY(-100%); }
@media (prefers-reduced-motion: reduce) {
  .bs-hq-layout__top-panel.bs-hq-brain-slide-enter-from,
  .bs-hq-layout__top-panel.bs-hq-brain-slide-leave-to { transform: none; }
}
.bs-hq-layout__record-panel--plans { inset-inline-start: var(--bs-space-3); width: min(max(var(--bs-component-hq-glass-plans-width), var(--bs-component-hq-glass-detail-width)), calc(100% - var(--bs-space-6))); }
@media (max-width: 1250px) {
  .bs-hq-layout__agent-panel, .bs-hq-layout__record-panel { inset-inline-start: var(--bs-space-3); width: min(var(--bs-component-hq-glass-plans-width), calc(100% - var(--bs-space-6))); }
  .bs-hq-layout__workplace-panel--behind, .bs-hq-layout__chat-panel--behind { visibility: hidden; pointer-events: none; }
}


@media (max-width: 1250px) {
  .bs-hq-layout__navigation { top: 76px; }
  .bs-hq-layout__session { width: 196px; }
  .bs-hq-layout__brain-panel { inset-block-start: 132px; }
}
@media (max-width: 840px) {
  .bs-hq-layout__session { inset-block-start: 140px; inset-inline-end: 16px; }
  .bs-hq-layout__workspace-area--brain .bs-hq-layout__workspace-info { display: none; }
  .bs-hq-layout__workspace-area--brain .bs-hq-layout__minimap { display: none; }
  .bs-hq-layout__minimap { width: 180px; height: 180px; }
  .bs-hq-layout__workspace-area--brain .bs-hq-layout__footer { padding: 10px; justify-content: flex-end; }
  .bs-hq-layout__brain-panel { inset-block-end: 84px; padding: var(--bs-space-4); }
}
@media (max-width: 760px) {
  .bs-hq-layout__navigation { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: calc(100% - 24px); max-width: 460px; }
  .bs-hq-layout .bs-hq-layout__tab { padding-inline: 6px; white-space: normal; }
  .bs-hq-layout__workplace-picker { grid-column: 1 / -1; width: auto; min-width: 0; border-inline-start: 0; }
  .bs-hq-layout__session { inset-block-start: 218px; }
  .bs-hq-layout__brain-panel { inset-block-start: 216px; }
}
@media (max-width: 520px) {
  .bs-hq-layout { padding: 5px; }
  .bs-hq-layout__canvas { border-radius: 17px; }
  .bs-hq-layout__brand { inset-block-start: 12px; inset-inline-start: 12px; gap: 8px; max-width: calc(100% - 24px); }
  .bs-hq-layout__brand img { width: 27px; height: 36px; }
  .bs-hq-layout__brand h1 { font-size: 18px; }
  .bs-hq-layout__navigation { top: 64px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: calc(100% - 24px); max-width: 360px; padding: 3px; }
  .bs-hq-layout .bs-hq-layout__tab { flex: 1; padding: 7px 6px; font-size: 11px; }
  .bs-hq-layout__workplace-picker { grid-column: 1 / -1; width: auto; min-width: 0; border-inline-start: 0; }
  .bs-hq-layout__session { inset-block-start: 204px; inset-inline-end: 12px; width: 172px; padding: 8px; gap: 6px; border-radius: 13px; }
  .bs-hq-layout__status { font-size: 10px; }
  .bs-hq-layout .bs-hq-layout__ceo, .bs-hq-layout .bs-hq-layout__login { font-size: 11px; }
  .bs-hq-layout__brain-panel { inset-block-start: 202px; }
  .bs-hq-layout__footer { padding: 12px; gap: 10px; }
  .bs-hq-layout__workspace-info { max-width: 160px; }
  .bs-hq-layout__gesture-hint { font-size: 9px; }
  .bs-hq-layout__keyboard-hint { display: none; }
  .bs-hq-layout__view { gap: 8px; }
  .bs-hq-layout__minimap { width: 144px; height: 144px; }
  .bs-hq-layout__zoom { grid-template-columns: repeat(3, 32px); }
  .bs-hq-layout .bs-hq-layout__zoom button { width: 32px; height: 32px; border-radius: 9px; }
}
@media (max-width: 374px) {
  .bs-hq-layout__workspace-info { max-width: 120px; }
  .bs-hq-layout__gesture-hint { display: none; }
  .bs-hq-layout__minimap { width: 128px; height: 128px; }
}
@media (max-height: 500px) and (min-width: 761px) {
  .bs-hq-layout__brand { inset-block-start: 12px; }
  .bs-hq-layout__navigation { top: 12px; }
  .bs-hq-layout__brand h1 { font-size: 16px; }
  .bs-hq-layout__session { inset-block-start: 72px; width: 180px; }
  .bs-hq-layout__brain-panel { inset-block-start: 72px; }
  .bs-hq-layout__gesture-hint { display: none; }
}
@media (max-height: 500px) and (min-width: 761px) and (max-width: 760px) {
  .bs-hq-layout__brand h1 { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
}
@media (pointer: coarse) {
  .bs-hq-layout__mouse-hint { display: none; }
  .bs-hq-layout__touch-hint { display: inline; }
  .bs-hq-layout__keyboard-hint { display: none; }
}
@media (prefers-reduced-motion: reduce) { .bs-hq-brain-slide-enter-active, .bs-hq-brain-slide-leave-active { transition: none; } }
</style>

<style src="../styles/hqGlassPanel.css"></style>
