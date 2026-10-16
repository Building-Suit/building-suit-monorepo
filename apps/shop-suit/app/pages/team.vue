<script setup lang="ts">
import { shopPermissionMenu } from '~/utils/shopPermissionMenu'
import type { BsAccessIdentityForm, BsAccessRoleForm, BsAccessPageCopy, BsAccessRoleView, BsAccessInvitationView, BsAccessMemberView, BsAccessMemberAction  } from '@building-suit/ui/access-presentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { TeamMember, TeamSnapshot, TeamRole } from '~/types/team'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const route = useRoute()
const sessionUser = useSupabaseUser()
const runtime = useRuntimeConfig()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale, t } = useI18n()
const { current, currentId, currentMembership, loading: shopLoading, reload, selectShop } = useShop()
const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const isArabic = computed(() => locale.value === 'ar')
const inviteCode = computed(() => typeof route.query.invite === 'string' ? route.query.invite : '')
const accepting = ref(false)
const acceptError = ref('')
const actionError = ref('')
const actionPending = ref(false)
const invitationLink = ref('')
const inviteRequestId = ref('')
const showInvite = ref(false)
const showEdit = ref(false)
const showTransfer = ref(false)
const selectedMember = ref<TeamMember | null>(null)
const view = ref('members')
const statusFilter = ref('')
const showRole = ref(false)
const roleForm = reactive({ key: null as string | null, name: '', nameAr: '', permissionKeys: [] as string[] })
const { dirty: roleDirty } = useRecordAction(() => roleForm, showRole)
const inviteForm = reactive({ name: '', jobTitle: '', email: '', roleKey: 'staff', locationIds: [] as string[] })
const editForm = reactive({ name: '', jobTitle: '', roleKey: 'staff', locationIds: [] as string[] })
const transferReason = ref('')
const { dirty: inviteDirty } = useRecordAction(() => inviteForm, showInvite)
const { dirty: editDirty } = useRecordAction(() => editForm, showEdit)
const { dirty: transferDirty } = useRecordAction(() => transferReason.value, showTransfer)

const copy = computed(() => isArabic.value ? {
  members: 'الأعضاء', roles: 'الأدوار والصلاحيات', newRole: 'إضافة دور', editRole: 'تعديل الصلاحيات', nameAr: 'اسم الدور بالعربية', nameEn: 'اسم الدور بالإنجليزية', jobTitle: 'المسمى الوظيفي', search: 'بحث الأعضاء', allStatuses: 'كل الحالات', archiveRole: 'أرشفة الدور', confirmArchive: 'تأرشف الدور؟ لازم تنقل الأعضاء والدعوات النشطة لدور تاني الأول.', claimHelp: 'الموظف هيقبل الدعوة بحسابه أو ينشئ حسابه ويختار كلمة المرور بنفسه.', title: 'الفريق والصلاحيات', subtitle: 'ضيف الموظفين، وحدد دور كل واحد وفروعه، واقفل وصوله من غير ما تحذف سجله.',
  invite: 'إضافة أو دعوة موظف', inviteTitle: 'إضافة عضو للفريق', name: 'الاسم', email: 'البريد الإلكتروني', role: 'الدور', locations: 'الفروع', permissions: 'الصلاحيات', status: 'الحالة', actions: 'الإجراءات',
  manager: 'مدير', cashier: 'كاشير', barber: 'مقدم خدمة', staff: 'موظف', owner: 'المالك',
  active: 'نشط', suspended: 'موقوف', removed: 'مزال', invited: 'مدعو', pending: 'بانتظار القبول', accepted: 'مقبولة', expired: 'منتهية', revoked: 'ملغاة',
  save: 'حفظ', saving: 'بنحفظ…', cancel: 'إلغاء', edit: 'تعديل بيانات العضو', suspend: 'إيقاف', reactivate: 'تشغيل تاني', remove: 'إزالة', transfer: 'نقل الملكية',
  acceptTitle: 'دعوة للانضمام للفريق', acceptHelp: 'اقبل الدعوة بالحساب اللي بريده هو نفس البريد المدعو.', accept: 'اقبل الدعوة', accepting: 'بنقبل الدعوة…',
  noTeam: 'مفيش أعضاء في الفريق لسه.', invitations: 'الدعوات', noInvitations: 'مفيش دعوات.', audit: 'سجل إدارة الفريق', noAudit: 'مفيش إجراءات متسجلة.',
  reason: 'سبب نقل الملكية', transferHelp: 'العضو اللي اخترته هيبقى المالك، والمالك الحالي هيبقى مدير. كل السجلات هتفضل محفوظة.',
  chooseLocation: 'اختار فرع واحد على الأقل.', invitationReady: 'الدعوة جاهزة. شارك الرابط ده بأمان مع الموظف:', added: 'اتضاف العضو.', updated: 'اتحدّث عضو الفريق.', acceptedInvite: 'اتقبلت الدعوة.',
  loadError: 'مقدرناش نحمّل الفريق.', actionFailed: 'مقدرناش ننفّذ الإجراء. راجع الصلاحيات وحاول تاني.', permissionDenied: 'معندكش صلاحية تشوف الفريق.',
  confirmSuspend: 'توقف العضو ده فورًا؟ أي عملية محمية شغالة أو جديدة هتترفض.', confirmRemove: 'تشيل العضو ده؟ مش هيقدر يدخل، وسجل نشاطه هيفضل محفوظ.', confirmTransfer: 'تنقل الملكية؟ لازم النشاط يفضل ليه مالك شغال.',
  revoke: 'إلغاء الدعوة', confirmRevoke: 'تلغي الدعوة دي؟ رابط القبول مش هيشتغل بعدها.',
  date: 'التاريخ', action: 'الإجراء', actor: 'نفّذه', member: 'العضو', retry: 'حاول تاني', close: 'إغلاق',
} : {
  members: 'Members', roles: 'Roles & permissions', newRole: 'Add role', editRole: 'Edit permissions', nameAr: 'Role name in Arabic', nameEn: 'Role name in English', jobTitle: 'Job title', search: 'Search members', allStatuses: 'All statuses', archiveRole: 'Archive role', confirmArchive: 'Archive this role? Reassign its members and live invitations first.', claimHelp: 'Staff accept with their existing account or create an account and choose their own password.', title: 'Team & permissions', subtitle: 'Invite staff, assign roles and locations, and stop access without deleting history.',
  invite: 'Add or invite staff', inviteTitle: 'Add a team member', name: 'Name', email: 'Email', role: 'Role', locations: 'Locations', permissions: 'Permissions', status: 'Status', actions: 'Actions',
  manager: 'Manager', cashier: 'Cashier', barber: 'Operator / service provider', staff: 'Staff', owner: 'Owner',
  active: 'Active', suspended: 'Suspended', removed: 'Removed', invited: 'Invited', pending: 'Pending', accepted: 'Accepted', expired: 'Expired', revoked: 'Revoked',
  save: 'Save', saving: 'Saving…', cancel: 'Cancel', edit: 'Edit member', suspend: 'Suspend', reactivate: 'Reactivate', remove: 'Remove', transfer: 'Transfer ownership',
  acceptTitle: 'Team invitation', acceptHelp: 'Accept with the account whose email matches the invitation.', accept: 'Accept invitation', accepting: 'Accepting…',
  noTeam: 'No team members yet.', invitations: 'Invitations', noInvitations: 'No invitations.', audit: 'Team administration audit', noAudit: 'No recorded actions.',
  reason: 'Ownership-transfer reason', transferHelp: 'The selected member becomes owner and the current owner becomes a manager. All history is preserved.',
  chooseLocation: 'Choose at least one location.', invitationReady: 'Invitation created. Share this link securely with the staff member:', added: 'Team member added.', updated: 'Team member updated.', acceptedInvite: 'Invitation accepted.',
  loadError: 'Could not load the team.', actionFailed: 'The action could not be completed. Check permissions and try again.', permissionDenied: 'You do not have permission to view the team.',
  confirmSuspend: 'Suspend this member immediately? Their current and new protected operations will be denied.', confirmRemove: 'Remove this member? Access is blocked while operational history is preserved.', confirmTransfer: 'Confirm ownership transfer? The business can never be left without an active owner.',
  revoke: 'Revoke invite', confirmRevoke: 'Revoke this invitation? Its acceptance link will stop working.',
  date: 'Date', action: 'Action', actor: 'Actor', member: 'Member', retry: 'Retry', close: 'Close',
})

const emptySnapshot = (): TeamSnapshot => ({
  canManage: false, canManagePermissions: false, canViewAudit: false,
  permissionKeys: [], grantablePermissionKeys: [], members: [], roles: [], locations: [], invitations: [], events: [],
})

const { data: team, pending, error, refresh } = useAsyncData(
  computed(() => `shop-data:team:${runtime.public.supabase.url}:shop-crm:${sessionUser.value?.id ?? ''}:${currentId.value ?? ''}`),
  async (): Promise<TeamSnapshot> => {
    if (!currentId.value) return emptySnapshot()
    const { data, error: readError } = await shopRpc.rpc('shop_team_read', { p_shop_id: currentId.value })
    if (readError) throw readError
    return data as TeamSnapshot
  },
  { watch: [currentId], default: emptySnapshot },
)

const teamErrorMessage = computed(() => error.value?.message.includes('SHOP_PERMISSION_DENIED') ? copy.value.permissionDenied : copy.value.loadError)
const activeLocations = computed(() => team.value.locations.filter(location => location.status === 'active'))
const isOwner = computed(() => currentMembership.value?.role === 'owner')

const visibleMembers = computed(() => team.value.members.filter(member => !statusFilter.value || member.status === statusFilter.value))
const displayedRoles = computed(() => [{ key: 'owner', name: copy.value.owner, nameAr: copy.value.owner, isSystem: true, permissionKeys: team.value.permissionKeys }, ...team.value.roles.filter(role => role.key !== 'owner')])
const assignableRoles = computed(() => team.value.roles.filter(role => role.key !== 'owner' && (team.value.canManagePermissions || role.key !== 'manager') && role.permissionKeys.every(key => team.value.grantablePermissionKeys.includes(key))))
const tabs = computed(() => [{ key: 'members', label: copy.value.members, count: team.value.members.length }, { key: 'roles', label: copy.value.roles, count: displayedRoles.value.length }, ...(team.value.canManage ? [{ key: 'invitations', label: copy.value.invitations, count: team.value.invitations.length }] : [])])

watch([currentId, () => sessionUser.value?.id], () => { showInvite.value = false; showEdit.value = false; showRole.value = false; showTransfer.value = false; selectedMember.value = null; invitationLink.value = ''; actionError.value = ''; statusFilter.value = ''; view.value = 'members' })

function roleLabel(key: string) {
  const role = team.value.roles.find(role => role.key === key)
  if (role && !role.isSystem) return isArabic.value ? role.nameAr || role.name : role.name
  return copy.value[key as 'manager' | 'cashier' | 'barber' | 'staff' | 'owner'] ?? key
}

function statusLabel(status: string) {
  return copy.value[status as 'active' | 'suspended' | 'removed' | 'invited' | 'pending' | 'accepted' | 'expired' | 'revoked'] ?? status
}

function permissionLabel(permission: string) {
  if (!isArabic.value) return permission.split('.').map(part => part.replaceAll('_', ' ')).join(' · ')
  const labels: Record<string, string> = {
    products: 'المنتجات', services: 'الخدمات', inventory: 'المخزون', sales: 'المبيعات',
    payments: 'المدفوعات', vendors: 'الموردون', vendor_invoices: 'المشتريات',
    supplier_payments: 'مدفوعات الموردين', supplier_credits: 'أرصدة الموردين',
    purchase_returns: 'مرتجعات المشتريات', clients: 'العملاء', expenses: 'المصروفات',
    reports: 'التقارير', settings: 'الإعدادات', discounts: 'الخصومات', team: 'الفريق',
    view: 'عرض', manage: 'إدارة', issue: 'إصدار', receive: 'تحصيل', reverse: 'عكس',
    refund: 'استرداد', record: 'تسجيل', adjust: 'تسوية', audit: 'التدقيق',
    appointments: 'المواعيد', schedule: 'جدول العمل', cash_shifts: 'ورديات الخزنة', use: 'استخدام', permissions: 'الصلاحيات', cost_profit: 'التكلفة والربح',
  }
  return permission.split('.').map(part => labels[part] ?? part).join(' · ')
}

function memberName(member: TeamMember) {
  return member.name || member.email || member.id
}

function locationNames(ids: string[]) {
  return ids.map(id => team.value.locations.find(location => location.id === id)?.name).filter(Boolean).join(', ') || '—'
}

function resetInvite() {
  inviteRequestId.value = crypto.randomUUID()
  Object.assign(inviteForm, { name: '', jobTitle: '', email: '', roleKey: 'staff', locationIds: [] })
  actionError.value = ''
  invitationLink.value = ''
}

function openInvite() {
  resetInvite()
  if (activeLocations.value.length === 1) inviteForm.locationIds = [activeLocations.value[0]!.id]
  showInvite.value = true
}

function openEdit(member: TeamMember) {
  selectedMember.value = member
  editForm.name = member.name || ''
  editForm.jobTitle = member.jobTitle || ''
  editForm.roleKey = member.roleKey === 'owner' ? 'manager' : member.roleKey
  editForm.locationIds = [...member.locationIds]
  actionError.value = ''
  showEdit.value = true
}

async function sendInvite() {
  if (!currentId.value || actionPending.value || !team.value.canManage || invitationLink.value) return
  if (!inviteForm.locationIds.length) { actionError.value = copy.value.chooseLocation; return }
  actionPending.value = true
  actionError.value = ''
  invitationLink.value = ''
  try {
    const { data, error: commandError } = await shopRpc.rpc('invite_shop_staff', {
      p_request_id: inviteRequestId.value, p_shop_id: currentId.value,
      p_email: inviteForm.email.trim(), p_job_title: inviteForm.jobTitle.trim() || null, p_display_name: inviteForm.name.trim(),
      p_role_key: inviteForm.roleKey, p_location_ids: inviteForm.locationIds,
    })
    if (commandError) throw commandError
    const result = data as { kind: 'added' | 'invited'; invitationCode?: string }
    if (result.kind === 'invited' && result.invitationCode) {
      invitationLink.value = `${window.location.origin}/auth/team-invitation?invite=${result.invitationCode}`
    } else {
      pushToast({ tone: 'success', title: copy.value.added })
      showInvite.value = false
    }
    await refresh()
  } catch (error) { actionError.value = planQuotaMessage(error, locale.value) ?? copy.value.actionFailed }
  finally { actionPending.value = false }
}

async function saveMember() {
  const member = selectedMember.value
  if (!member || !currentId.value || actionPending.value) return
  if (!editForm.locationIds.length) { actionError.value = copy.value.chooseLocation; return }
  actionPending.value = true
  actionError.value = ''
  try {
    const { error: memberError } = await shopRpc.rpc('save_shop_team_member', {
      p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_membership_id: member.id,
      p_full_name: editForm.name.trim(), p_job_title: editForm.jobTitle.trim() || null,
      p_role_key: editForm.roleKey, p_location_ids: editForm.locationIds,
    })
    if (memberError) throw memberError
    showEdit.value = false
    await refresh()
    pushToast({ tone: 'success', title: copy.value.updated })
  } catch (error) { actionError.value = planQuotaMessage(error, locale.value) ?? copy.value.actionFailed }
  finally { actionPending.value = false }
}

async function memberAction(member: TeamMember, action: 'suspend' | 'reactivate' | 'remove') {
  if (!currentId.value || actionPending.value || member.roleKey === 'owner') return
  const prompt = action === 'suspend' ? copy.value.confirmSuspend : action === 'remove' ? copy.value.confirmRemove : null
  if (prompt && !await confirmation.ask(prompt)) return
  actionPending.value = true
  actionError.value = ''
  try {
    const { error: commandError } = await shopRpc.rpc('manage_shop_member', {
      p_request_id: crypto.randomUUID(), p_shop_id: currentId.value,
      p_membership_id: member.id, p_action: action,
    })
    if (commandError) throw commandError
    await refresh()
    pushToast({ tone: 'success', title: copy.value.updated })
  } catch (error) { actionError.value = planQuotaMessage(error, locale.value) ?? copy.value.actionFailed }
  finally { actionPending.value = false }
}

function openTransfer(member: TeamMember) {
  selectedMember.value = member
  transferReason.value = ''
  actionError.value = ''
  showTransfer.value = true
}

async function transferOwnership() {
  if (!currentId.value || !selectedMember.value || transferReason.value.trim().length < 2
    || actionPending.value || !await confirmation.ask(copy.value.confirmTransfer)) return
  actionPending.value = true
  actionError.value = ''
  try {
    const { error: commandError } = await shopRpc.rpc('transfer_shop_ownership', {
      p_request_id: crypto.randomUUID(), p_shop_id: currentId.value,
      p_target_membership_id: selectedMember.value.id, p_reason: transferReason.value.trim(),
    })
    if (commandError) throw commandError
    showTransfer.value = false
    await reload()
    await refresh()
    pushToast({ tone: 'success', title: copy.value.updated })
  } catch { actionError.value = copy.value.actionFailed }
  finally { actionPending.value = false }
}

async function acceptInvitation() {
  if (!inviteCode.value || accepting.value) return
  accepting.value = true
  acceptError.value = ''
  try {
    const { data: acceptedShop, error: commandError } = await shopRpc.rpc('accept_shop_invitation', {
      p_request_id: crypto.randomUUID(), p_invitation_code: inviteCode.value,
    })
    if (commandError) throw commandError
    await navigateTo('/team', { replace: true })
    await reload()
    if (acceptedShop) await selectShop(acceptedShop)
    await refresh()
    pushToast({ tone: 'success', title: copy.value.acceptedInvite })
  } catch { acceptError.value = copy.value.actionFailed }
  finally { accepting.value = false }
}

async function revokeInvitation(invitationId: string) {
  if (!currentId.value || actionPending.value || !await confirmation.ask(copy.value.confirmRevoke)) return
  actionPending.value = true
  actionError.value = ''
  try {
    const { error: commandError } = await shopRpc.rpc('revoke_shop_invitation', {
      p_request_id: crypto.randomUUID(), p_shop_id: currentId.value,
      p_invitation_id: invitationId, p_reason: null,
    })
    if (commandError) throw commandError
    await refresh()
  } catch { actionError.value = copy.value.actionFailed }
  finally { actionPending.value = false }
}

function openRole(role?: TeamRole) {
  Object.assign(roleForm, { key: role?.key ?? null, name: role?.name ?? '', nameAr: role?.nameAr || (role ? roleLabel(role.key) : ''), permissionKeys: [...(role?.permissionKeys ?? [])] })
  actionError.value = ''
  showRole.value = true
}

async function saveRole(archive = false) {
  if (!currentId.value || actionPending.value || !team.value.canManagePermissions) return
  if (archive && !await confirmation.ask(copy.value.confirmArchive)) return
  actionPending.value = true
  actionError.value = ''
  try {
    const { error: roleError } = await shopRpc.rpc('save_shop_team_role', {
      p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_role_key: roleForm.key,
      p_name: roleForm.name.trim(), p_name_ar: roleForm.nameAr.trim(), p_permission_keys: roleForm.permissionKeys, p_archive: archive,
    })
    if (roleError) throw roleError
    showRole.value = false
    await refresh()
    pushToast({ tone: 'success', title: copy.value.updated })
  } catch { actionError.value = copy.value.actionFailed }
  finally { actionPending.value = false }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

useShopRealtime('team', () => roleDirty.value || inviteDirty.value || editDirty.value || transferDirty.value)
const memberViews = computed<BsAccessMemberView[]>(() => visibleMembers.value.map(member => {
  const actions: BsAccessMemberAction[] = []
  if (team.value.canManage && member.roleKey !== 'owner' && member.status !== 'removed') {
    actions.push({ key: 'edit', label: copy.value.edit, tone: 'secondary' }, { key: member.status === 'active' ? 'suspend' : 'reactivate', label: member.status === 'active' ? copy.value.suspend : copy.value.reactivate, tone: 'secondary' }, { key: 'remove', label: copy.value.remove, tone: 'danger' })
    if (isOwner.value && member.status === 'active') actions.push({ key: 'transfer', label: copy.value.transfer })
  }
  return { id: member.id, name: memberName(member), email: member.email || '—', jobTitle: member.jobTitle || undefined, role: roleLabel(member.roleKey), locations: member.roleKey === 'owner' ? activeLocations.value.map(location => location.name).join(', ') : locationNames(member.locationIds), status: member.status, statusLabel: statusLabel(member.status), actions }
}))
function memberViewAction(key: BsAccessMemberAction['key'], id: string) {
  const member = team.value.members.find(row => row.id === id)
  if (!member) return
  if (key === 'edit') openEdit(member)
  else if (key === 'transfer') openTransfer(member)
  else void memberAction(member, key)
}
const invitationViews = computed<BsAccessInvitationView[]>(() => team.value.invitations.map(invitation => ({ id: invitation.id, email: invitation.email, role: roleLabel(invitation.roleKey), status: invitation.status, statusLabel: statusLabel(invitation.status), sent: formatDate(invitation.createdAt), actions: invitation.status === 'pending' ? [{ key: 'revoke', label: copy.value.revoke, tone: 'secondary' }] : [] })))
const accessCopy = computed<BsAccessPageCopy>(() => ({
  title: copy.value.title, subtitle: copy.value.subtitle, members: copy.value.title, roles: copy.value.roles, invitations: copy.value.invitations, noMembers: copy.value.noTeam, noInvitations: copy.value.noInvitations, invite: copy.value.invite, newRole: copy.value.newRole, retry: copy.value.retry, noTeam: copy.value.noTeam,
  memberColumns: { name: copy.value.member, role: copy.value.role, locations: copy.value.locations, status: copy.value.status, actions: copy.value.actions },
  invitationColumns: { email: copy.value.email, role: copy.value.role, status: copy.value.status, sent: copy.value.date, actions: copy.value.actions },
  audit: { title: copy.value.audit, empty: copy.value.noAudit, action: copy.value.action, actor: copy.value.actor, reason: copy.value.reason, date: copy.value.date },
}))
const roleViews = computed<BsAccessRoleView[]>(() => displayedRoles.value.map(role => ({ id: role.key, label: roleLabel(role.key), permissions: role.permissionKeys.map(permissionLabel).join(', ') || '—', actions: team.value.canManagePermissions && role.key !== 'owner' ? [{ key: 'edit', label: copy.value.editRole }] : [] })))
const auditViews = computed(() => team.value.events.map(event => ({ id: event.id, action: event.action, actor: event.actorEmail || '', reason: event.reason || '', date: formatDate(event.occurredAt) })))
function roleViewAction(_key: 'edit' | 'remove', id: string) {
  const role = displayedRoles.value.find(row => row.key === id)
  if (role) openRole(role)
}
const invitationPresentationForm = computed<BsAccessIdentityForm>({ get: () => ({ name: inviteForm.name, jobTitle: inviteForm.jobTitle, email: inviteForm.email, role: inviteForm.roleKey, locationIds: inviteForm.locationIds }), set: value => { Object.assign(inviteForm, { name: value.name, jobTitle: value.jobTitle, email: value.email, roleKey: value.role, locationIds: value.locationIds }) } })
const memberPresentationForm = computed<BsAccessIdentityForm>({ get: () => ({ name: editForm.name, jobTitle: editForm.jobTitle, email: selectedMember.value?.email || '', role: editForm.roleKey, locationIds: editForm.locationIds }), set: value => { Object.assign(editForm, { name: value.name, jobTitle: value.jobTitle, roleKey: value.role, locationIds: value.locationIds }) } })
const rolePresentationForm = computed<BsAccessRoleForm>({ get: () => ({ name: roleForm.name, nameAr: roleForm.nameAr, permissions: roleForm.permissionKeys }), set: value => { Object.assign(roleForm, { name: value.name, nameAr: value.nameAr, permissionKeys: value.permissions }) } })
const identityCopy = computed(() => ({ name: copy.value.name, jobTitle: copy.value.jobTitle, email: copy.value.email, emailMaxLength: 254, role: copy.value.role, locations: copy.value.locations }))
const identityRoles = computed(() => assignableRoles.value.map(role => ({ value: role.key, label: roleLabel(role.key), disabled: false })))
const invitationEditor = computed(() => ({ state: { visible: showInvite.value, title: copy.value.inviteTitle, dirty: inviteDirty.value && !invitationLink.value, pending: actionPending.value, error: actionError.value, submitLabel: copy.value.save, cancelLabel: invitationLink.value ? copy.value.close : copy.value.cancel }, copy: { ...identityCopy.value, help: copy.value.claimHelp, ready: copy.value.invitationReady }, roles: identityRoles.value, locations: activeLocations.value.map(location => ({ id: location.id, name: location.name })), link: invitationLink.value }))
const memberEditor = computed(() => ({ state: { visible: showEdit.value, title: copy.value.edit, dirty: editDirty.value, pending: actionPending.value, error: actionError.value, submitLabel: copy.value.save, cancelLabel: copy.value.cancel }, copy: identityCopy.value, roles: identityRoles.value, locations: activeLocations.value.map(location => ({ id: location.id, name: location.name })), roleDisabled: !team.value.canManagePermissions }))
const roleEditor = computed(() => ({ state: { visible: showRole.value, title: roleForm.key ? copy.value.editRole : copy.value.newRole, dirty: roleDirty.value, pending: actionPending.value, error: actionError.value, submitLabel: copy.value.save, cancelLabel: copy.value.cancel }, names: { english: copy.value.nameEn, arabic: copy.value.nameAr, maxLength: 160, minLength: 2 }, permissionLabel: copy.value.permissions, permissions: shopPermissionMenu(team.value.permissionKeys, team.value.grantablePermissionKeys, locale.value, t, permissionLabel), archiveLabel: roleForm.key && !team.value.roles.find(role => role.key === roleForm.key)?.isSystem ? copy.value.archiveRole : undefined }))
const transferEditor = computed(() => ({ state: { visible: showTransfer.value, title: copy.value.transfer, dirty: transferDirty.value, pending: actionPending.value, error: actionError.value, submitLabel: copy.value.transfer, cancelLabel: copy.value.cancel }, help: copy.value.transferHelp, reasonLabel: copy.value.reason }))
const acceptancePresentation = computed(() => inviteCode.value ? ({ title: copy.value.acceptTitle, help: copy.value.acceptHelp, error: acceptError.value, pending: accepting.value, actionLabel: accepting.value ? copy.value.accepting : copy.value.accept }) : undefined)
</script>

<template>
  <BsAccessManagementPage
    v-model:active-tab="view"
    v-model:status-filter="statusFilter"
    v-model:invitation-form="invitationPresentationForm"
    v-model:member-form="memberPresentationForm"
    v-model:role-form="rolePresentationForm"
    v-model:transfer-reason="transferReason"
    :copy="accessCopy"
    :tabs="tabs"
    :members="memberViews"
    :roles="roleViews"
    :invitations="invitationViews"
    :audit="team.canViewAudit ? auditViews : undefined"
    :loading="shopLoading || pending"
    :error="error ? teamErrorMessage : null"
    :action-error="actionError"
    :available="Boolean(current)"
    :can-invite="Boolean(current && team.canManage)"
    :can-create-role="team.canManagePermissions"
    :pending="actionPending"
    :status-label="copy.status"
    :status-options="[{ value: '', label: copy.allStatuses }, ...['active', 'suspended', 'removed'].map(value => ({ value, label: statusLabel(value) }))]"
    :invitation-editor="invitationEditor"
    :member-editor="memberEditor"
    :role-editor="roleEditor"
    :transfer-editor="transferEditor"
    :acceptance="acceptancePresentation"
    @invite="openInvite"
    @create-role="openRole()"
    @retry="refresh()"
    @member-action="memberViewAction"
    @invitation-action="(_key, id) => revokeInvitation(id)"
    @role-action="roleViewAction"
    @accept="acceptInvitation"
    @close-invitation="showInvite = false"
    @submit-invitation="sendInvite"
    @close-member="showEdit = false"
    @submit-member="saveMember"
    @close-role="showRole = false"
    @submit-role="saveRole()"
    @archive-role="saveRole(true)"
    @close-transfer="showTransfer = false"
    @submit-transfer="transferOwnership"
  />
</template>
