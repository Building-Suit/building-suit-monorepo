import type { Ref } from 'vue'
import type { BsAccessIdentityForm, BsAccessMemberAction, BsAccessMemberView, BsAccessInvitationView } from '@building-suit/ui/access-presentation'
import { useRecordAction } from '@building-suit/ux'
import { doctorScopeKey } from '../utils/contextScope'
import { doctorAdministrativeCapabilities } from '../utils/locationContext'
import { doctorDelegationCopy, doctorDelegationError } from '../utils/delegationPresentation'
import { doctorDelegationPreset, doctorFormGrants } from '../utils/delegationForms'
import { validDoctorDelegationGrants, validDoctorInvitation, type DoctorTeamInvitation, type DoctorTeamMember } from '../utils/delegation'
const emptyForm = (): BsAccessIdentityForm => ({ name: '',jobTitle: '',email: '',role: 'schedule',locationIds: [],grants: [] })
export function useDoctorTeamManagement() {
  const context = useDoctorContext(); const team = useDoctorTeam(); const getScope = useNuxtApp().$doctorTeamScope
  const { locale } = useI18n(); const ar = computed(() => locale.value==='ar'); const copy = computed(() => doctorDelegationCopy(ar.value))
  const hydrated = ref(false); onMounted(() => { hydrated.value = true })
  const scopeKey = computed(() => { const scope = getScope(); return scope ? doctorScopeKey(scope,'team') : null })
  const query = reactive({ page: 0,size: 20,search: '' }); const activeTab = ref('members')
  const invitationForm = ref(emptyForm()); const memberForm = ref(emptyForm()); const selected = shallowRef<DoctorTeamMember | null>(null)
  const confirmation = shallowRef<{ member?: DoctorTeamMember; invitation?: DoctorTeamInvitation; status?: DoctorTeamMember['status'] } | null>(null)
  const inviting = useRecordAction(() => invitationForm.value); const editing = useRecordAction(() => memberForm.value); const confirming = useRecordAction(() => confirmation.value)
  function reset() { invitationForm.value = emptyForm(); memberForm.value = emptyForm(); selected.value = null; confirmation.value = null; query.page = 0; query.search = ''; activeTab.value = 'members'; inviting.reset(); editing.reset(); confirming.reset() }
  const unregister = context.registerClear(reset); onBeforeUnmount(() => { unregister(); reset(); team.clear() })
  function trackForm(form: Ref<BsAccessIdentityForm>) {
    watch(() => form.value.role, role => { if (role!=='selected') form.value = { ...form.value,grants: form.value.locationIds.map(locationId => ({ locationId,capabilities: doctorDelegationPreset(role) })) } })
    watch(() => form.value.locationIds.join(':'), () => { form.value = { ...form.value,grants: form.value.locationIds.map(locationId => ({ locationId,capabilities: form.value.grants?.find(item => item.locationId===locationId)?.capabilities || doctorDelegationPreset(form.value.role) })) } })
  }
  trackForm(invitationForm); trackForm(memberForm)
  async function reload() { const result = await team.load({ ...query }); if (!result && scopeKey.value && team.state.error==='denied') await context.refresh(); return result }
  watch(scopeKey, () => { reset(); if (hydrated.value) void reload() }, { flush: 'sync' })
  function search(value: string) { if (team.state.pending) return; query.search = value; query.page = 0; void reload() }
  function page(value: number) { if (team.state.pending) return; query.page = Math.max(0,value-1); void reload() }
  function tab(value: string) { if (team.state.pending || !['members','invitations'].includes(value)) return; activeTab.value = value; query.page = 0; void reload() }
  const capacity = computed(() => Boolean(team.state.directory && team.state.directory.locationTotal>team.state.directory.locations.length))
  const available = computed(() => Boolean(scopeKey.value) && team.available())
  const roles = computed(() => ['selected','read','schedule','all'].map(value => ({ value,label: copy.value[value as 'selected'|'read'|'schedule'|'all'] })))
  const grantOptions = computed(() => doctorAdministrativeCapabilities.map(key => ({ key,label: copy.value.capabilityLabels[key] })))
  const editorCopy = computed(() => ({ email: copy.value.email,emailMaxLength: 254,role: copy.value.preset,locations: copy.value.locations,permissions: copy.value.permissions,credentialLabel: copy.value.credentialLabel,ready: copy.value.ready,deliveryTitle: copy.value.deliveryTitle,deliveryHint: copy.value.deliveryHint }))
  const editorLocations = computed(() => (team.state.directory?.locations || []).map(item => ({ id: item.id,name: `${item.name}${item.archived ? ` · ${ar.value ? 'مؤرشف' : 'Archived'}` : ''}` })))
  function invite() {
    if (!hydrated.value || !available.value) return
    team.forgetCredential(); invitationForm.value = emptyForm()
    const location = context.state.current?.locationId
    if (location && team.state.directory?.locations.some(item => item.id===location && !item.archived)) invitationForm.value = { ...invitationForm.value,locationIds: [location],grants: [{ locationId: location,capabilities: doctorDelegationPreset('schedule') }] }
    inviting.create()
  }
  function closeInvitation() { inviting.reset(); team.forgetCredential(); invitationForm.value = emptyForm() }
  function memberAction(key: BsAccessMemberAction['key'],id: string) {
    const row = team.state.directory?.members.find(item => item.id===id)
    if (!hydrated.value || !available.value || !row) return
    if (key==='edit') {
      selected.value = { ...row }; memberForm.value = { name: '',jobTitle: '',email: row.email,role: 'selected',locationIds: row.grants.map(item => item.locationId),grants: row.grants.map(item => ({ locationId: item.locationId,capabilities: [...item.capabilities] })) }; editing.edit()
    } else if (['suspend','reactivate','remove'].includes(key)) { confirmation.value = { member: { ...row },status: key==='suspend' ? 'suspended' : key==='reactivate' ? 'active' : 'revoked' }; confirming.edit() }
  }
  function invitationAction(key: string,id: string) { const row = team.state.directory?.invitations.find(item => item.id===id); if (hydrated.value && available.value && key==='cancel' && row?.status==='pending') { confirmation.value = { invitation: { ...row } }; confirming.edit() } }
  async function command(run: () => Promise<boolean>) { if (!await run()) { if (team.state.error==='denied') await context.refresh(); throw new Error('DOCTOR_DELEGATION_COMMAND_FAILED') } }
  const describe = () => doctorDelegationError(team.state.error,ar.value) || copy.value.errors.network
  async function submitInvitation() {
    const grants = doctorFormGrants(invitationForm.value)
    if (!inviting.visible.value || !grants || !validDoctorInvitation({ email: invitationForm.value.email,grants },team.state.directory?.locations || [])) return
    const done = await inviting.run(() => command(() => team.invite({ email: invitationForm.value.email,grants })),describe)
    if (done) { inviting.edit(); await reload() }
  }
  async function submitMember() {
    const row = selected.value; const grants = doctorFormGrants(memberForm.value)
    if (!editing.visible.value || !row || !grants || !validDoctorDelegationGrants(grants,team.state.directory?.locations || [])) return
    const done = await editing.run(() => command(() => team.grants(row,grants)),describe)
    if (done) await reload()
  }
  async function submitConfirmation() {
    const value = confirmation.value
    if (!confirming.visible.value || !value) return
    const done = await confirming.run(() => command(() => value.member && value.status ? team.status(value.member,value.status) : team.cancel(value.invitation!)),describe)
    if (done) await reload()
  }
  const invitationEditor = computed(() => ({ state: { visible: inviting.visible.value,title: copy.value.inviteTitle,dirty: inviting.dirty.value,pending: inviting.pending.value,error: inviting.error.value,submitLabel: copy.value.create,cancelLabel: copy.value.cancel,submitDisabled: !validDoctorInvitation({ email: invitationForm.value.email,grants: doctorFormGrants(invitationForm.value) || [] },team.state.directory?.locations || []) },copy: editorCopy.value,roles: roles.value,locations: editorLocations.value.filter(item => !team.state.directory?.locations.find(location => location.id===item.id)?.archived),grantOptions: grantOptions.value,link: team.state.credential || undefined }))
  const memberEditor = computed(() => ({ state: { visible: editing.visible.value,title: copy.value.editTitle,dirty: editing.dirty.value,pending: editing.pending.value,error: editing.error.value,submitLabel: copy.value.save,cancelLabel: copy.value.cancel,submitDisabled: !doctorFormGrants(memberForm.value) || !validDoctorDelegationGrants(doctorFormGrants(memberForm.value) || [],team.state.directory?.locations || []) },copy: { ...editorCopy.value,deliveryTitle: undefined,deliveryHint: undefined,ready: undefined,credentialLabel: undefined },roles: roles.value,locations: editorLocations.value,grantOptions: grantOptions.value }))
  const confirmationEditor = computed(() => ({ state: { visible: confirming.visible.value,title: copy.value.actionTitle,dirty: false,pending: confirming.pending.value,error: confirming.error.value,submitLabel: copy.value.confirm,cancelLabel: copy.value.cancel },description: copy.value.actionDescription }))
  function date(value: string) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? new Intl.DateTimeFormat(ar.value ? 'ar' : 'en',{ dateStyle: 'medium',timeStyle: 'short',timeZone: 'UTC' }).format(parsed) : '' }
  const members = computed<BsAccessMemberView[]>(() => (team.state.directory?.members || []).map(row => ({ id: row.id,name: row.email,email: row.email,role: copy.value.administrative,status: row.status,statusLabel: copy.value[row.status],locations: row.grants.map(item => item.locationName).join(' · '),actions: available.value ? [{ key: 'edit',label: copy.value.edit },...(row.status==='active' ? [{ key: 'suspend' as const,label: copy.value.suspend },{ key: 'remove' as const,label: copy.value.revoke,tone: 'danger' as const }] : [{ key: 'reactivate' as const,label: copy.value.reactivate }])] : [] })))
  const invitations = computed<BsAccessInvitationView[]>(() => (team.state.directory?.invitations || []).map(row => ({ id: row.id,email: row.email,role: copy.value.administrative,status: row.status,statusLabel: copy.value[row.status],sent: date(row.createdAt),expires: `${date(row.expiresAt)} UTC`,actions: row.status==='pending' && available.value ? [{ key: 'cancel',label: copy.value.cancelInvitation }] : [] })))
  const pagination = computed(() => ({ page: query.page+1,size: query.size,total: activeTab.value==='members' ? team.state.directory?.memberTotal || 0 : team.state.directory?.invitationTotal || 0,label: copy.value.page,previous: copy.value.previous,next: copy.value.next }))
  const pageCopy = computed(() => ({ ...copy.value,noTeam: capacity.value ? copy.value.scopeLimit : copy.value.noTeam }))
  return { context,team,copy: pageCopy,scopeKey,query,activeTab,invitationForm,memberForm,hydrated,available,members,invitations,roles,invitationEditor,memberEditor,confirmationEditor,pagination,reload,search,page,tab,invite,memberAction,invitationAction,submitInvitation,submitMember,submitConfirmation,closeInvitation,closeMember: () => editing.reset(),closeConfirmation: () => confirming.reset(),error: computed(() => doctorDelegationError(team.state.error,ar.value)) }
}
