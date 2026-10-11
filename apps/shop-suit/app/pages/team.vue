<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { TeamMember, TeamSnapshot, TeamRole } from '~/types/team'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const route = useRoute()
const sessionUser = useSupabaseUser()
const runtime = useRuntimeConfig()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
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
const tabs = computed(() => [{ value: 'members', label: copy.value.members }, { value: 'roles', label: copy.value.roles }, ...(team.value.canManage ? [{ value: 'invitations', label: copy.value.invitations }] : [])])

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
</script>

<template>
  <BsStack>
    <BsPanel v-if="inviteCode">
      <BsHeading :level="1">{{ copy.acceptTitle }}</BsHeading>
      <BsText size="sm">{{ copy.acceptHelp }}</BsText>
      <BsText size="sm" v-if="acceptError" role="alert">{{ acceptError }}</BsText>
      <BsButton :pending="accepting" @click="acceptInvitation">{{ accepting ? copy.accepting : copy.accept }}</BsButton>
    </BsPanel>

    <BsInline as="header" justify="between">
      <BsStack><BsHeading :level="1">{{ copy.title }}</BsHeading><BsText size="sm" tone="muted">{{ copy.subtitle }}</BsText></BsStack>
      <BsButton v-if="current && team.canManage" @click="openInvite">{{ copy.invite }}</BsButton>
    </BsInline>

    <BsText v-if="shopLoading || pending" role="status">…</BsText>
    <BsStack v-else-if="error" role="alert">{{ teamErrorMessage }} <BsButton @click="refresh()">{{ copy.retry }}</BsButton></BsStack>
    <BsText size="sm" v-else-if="!current">{{ copy.noTeam }}</BsText>
    <template v-else>
      <BsText size="sm" v-if="actionError" role="alert">{{ actionError }}</BsText>
      <BsTabs v-model="view" :tabs="tabs" :label="copy.title" />
      <BsPanel v-if="view === 'members'">

        <BsDataTable :value="visibleMembers" searchable :search-label="copy.search" :search-fields="['name', 'email', 'jobTitle']" data-key="id" :label="copy.title" :columns="[{ key: 'column0', header: (copy.member) }, { key: 'column1', header: (copy.role) }, { key: 'column2', header: (copy.locations) }, { key: 'column3', header: (copy.status) }, { key: 'column4', header: (copy.actions), hidden: !(team.canManage) }]">
          <template #filters><BsSelect v-model="statusFilter" :label="copy.status" :options="[{ value: '', label: copy.allStatuses }, ...['active', 'suspended', 'removed'].map(value => ({ value, label: statusLabel(value) }))]" option-label="label" option-value="value" /></template>
          <template #cell-column0="{ row: member }"><BsText emphasis="bold">{{ memberName(member) }}</BsText><BsText size="xs" tone="muted">{{ member.email || '—' }}</BsText><BsText size="xs" tone="muted">{{ member.jobTitle }}</BsText></template>
          <template #cell-column1="{ row: member }">{{ roleLabel(member.roleKey) }}</template>
          <template #cell-column2="{ row: member }">{{ member.roleKey === 'owner' ? activeLocations.map(location => location.name).join(', ') : locationNames(member.locationIds) }}</template>
          <template #cell-column3="{ row: member }"><BsStatusBadge :status="member.status" /> <BsText as="span">{{ statusLabel(member.status) }}</BsText></template>
          <template #cell-column4="{ row: member }"><BsInline v-if="member.roleKey !== 'owner' && member.status !== 'removed'"><BsButton size="small" severity="secondary" @click="openEdit(member)">{{ copy.edit }}</BsButton><BsButton v-if="member.status === 'active'" size="small" severity="secondary" @click="memberAction(member, 'suspend')">{{ copy.suspend }}</BsButton><BsButton v-else size="small" severity="secondary" @click="memberAction(member, 'reactivate')">{{ copy.reactivate }}</BsButton><BsButton size="small" severity="danger" @click="memberAction(member, 'remove')">{{ copy.remove }}</BsButton><BsButton v-if="isOwner && member.status === 'active'" size="small" @click="openTransfer(member)">{{ copy.transfer }}</BsButton></BsInline></template>
          <template #empty><BsText size="sm" tone="muted">{{ copy.noTeam }}</BsText></template>
        </BsDataTable>
      </BsPanel>

      <BsPanel v-if="view === 'roles'">
        <BsDataTable :value="displayedRoles" data-key="key" :label="copy.roles" :capabilities="{ insert: team.canManagePermissions, edit: team.canManagePermissions }" :action-labels="{ insert: copy.newRole, edit: copy.editRole }" :can-row-action="(_action, role) => role.key !== 'owner'" @create="openRole()" @edit="openRole" :columns="[{ key: 'column0', header: (copy.role) }, { key: 'column1', header: (copy.permissions) }]">
          <template #cell-column0="{ row: role }">{{ roleLabel(role.key) }}</template>
          <template #cell-column1="{ row: role }"><BsText size="sm" tone="muted">{{ role.permissionKeys.map(permissionLabel).join(', ') || '—' }}</BsText></template>
        </BsDataTable>
      </BsPanel>

      <BsPanel v-if="view === 'invitations' && team.canManage"><BsHeading :level="2">{{ copy.invitations }}</BsHeading><BsDataTable :value="team.invitations" data-key="id" :label="copy.invitations" :columns="[{ key: 'column0', header: (copy.email), field: 'email' }, { key: 'column1', header: (copy.role) }, { key: 'column2', header: (copy.status) }, { key: 'column3', header: (copy.date) }, { key: 'column4', header: (copy.actions) }]"><template #cell-column1="{ row: invitation }">{{ roleLabel(invitation.roleKey) }}</template><template #cell-column2="{ row: invitation }">{{ statusLabel(invitation.status) }}</template><template #cell-column3="{ row: invitation }">{{ formatDate(invitation.createdAt) }}</template><template #cell-column4="{ row: invitation }"><BsButton v-if="invitation.status === 'pending'" size="small" severity="secondary" :disabled="actionPending" @click="revokeInvitation(invitation.id)">{{ copy.revoke }}</BsButton></template><template #empty><BsText size="sm" tone="muted">{{ copy.noInvitations }}</BsText></template></BsDataTable></BsPanel>

      <BsPanel v-if="view === 'members' && team.canViewAudit"><BsHeading :level="2">{{ copy.audit }}</BsHeading><BsDataTable :value="team.events" data-key="id" :label="copy.audit" :columns="[{ key: 'column0', header: (copy.action), field: 'action' }, { key: 'column1', header: (copy.actor), field: 'actorEmail' }, { key: 'column2', header: (copy.reason), field: 'reason' }, { key: 'column3', header: (copy.date) }]"><template #cell-column3="{ row: event }">{{ formatDate(event.occurredAt) }}</template><template #empty><BsText size="sm" tone="muted">{{ copy.noAudit }}</BsText></template></BsDataTable></BsPanel>
    </template>

    <BsRecordActionDialog v-model:visible="showInvite" :title="copy.inviteTitle" :dirty="inviteDirty && !invitationLink" :submit-disabled="Boolean(invitationLink)" :pending="actionPending" :error="actionError" :submit-label="copy.save" :cancel-label="invitationLink ? copy.close : copy.cancel" @submit="sendInvite">
        <BsFieldGroup :disabled="Boolean(invitationLink)">
        <BsField v-slot="field" :label="copy.name" required><BsInput :id="field.id" v-model="inviteForm.name" required minlength="2" maxlength="160" /></BsField>
        <BsText size="sm" tone="muted">{{ copy.claimHelp }}</BsText>
        <BsField v-slot="field" :label="copy.jobTitle"><BsInput :id="field.id" v-model="inviteForm.jobTitle" maxlength="160" /></BsField>
        <BsField v-slot="field" :label="copy.email" required><BsInput :id="field.id" v-model="inviteForm.email" type="email" required maxlength="254" /></BsField>
        <BsSelect v-model="inviteForm.roleKey" :label="copy.role" :options="assignableRoles.map(role => ({ value: role.key, label: roleLabel(role.key) }))" option-label="label" option-value="value" />
        <BsChoiceGroup v-model="inviteForm.locationIds" :legend="copy.locations" :options="activeLocations.map(location => ({ value: location.id, label: location.name }))" />
        </BsFieldGroup>
        <BsText size="sm" tone="muted" v-if="invitationLink" role="status"><BsText as="strong" emphasis="bold">{{ copy.invitationReady }}</BsText><BsInput :model-value="invitationLink" readonly @focus="($event.target as HTMLInputElement).select()" /></BsText>
    </BsRecordActionDialog>

    <BsRecordActionDialog v-model:visible="showEdit" :title="copy.edit" :dirty="editDirty" :pending="actionPending" :error="actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="saveMember">
        <BsField v-slot="field" :label="copy.name" required><BsInput :id="field.id" v-model="editForm.name" required minlength="2" maxlength="160" /></BsField>
        <BsField v-slot="field" :label="copy.jobTitle"><BsInput :id="field.id" v-model="editForm.jobTitle" maxlength="160" /></BsField>
        <BsSelect v-model="editForm.roleKey" :label="copy.role" :options="assignableRoles.map(role => ({ value: role.key, label: roleLabel(role.key) }))" option-label="label" option-value="value" :disabled="!team.canManagePermissions" />
        <BsChoiceGroup v-model="editForm.locationIds" :legend="copy.locations" :options="activeLocations.map(location => ({ value: location.id, label: location.name }))" />
    </BsRecordActionDialog>

    <BsRecordActionDialog v-model:visible="showRole" :title="roleForm.key ? copy.editRole : copy.newRole" :dirty="roleDirty" :pending="actionPending" :error="actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="saveRole()">
      <BsField v-slot="field" :label="copy.nameEn" required><BsInput :id="field.id" v-model="roleForm.name" required minlength="2" maxlength="160" /></BsField>
      <BsField v-slot="field" :label="copy.nameAr" required><BsInput :id="field.id" v-model="roleForm.nameAr" required minlength="2" maxlength="160" dir="rtl" /></BsField>
      <BsChoiceGroup v-model="roleForm.permissionKeys" :legend="copy.permissions" :options="team.permissionKeys.map(key => ({ value: key, label: permissionLabel(key), disabled: !team.grantablePermissionKeys.includes(key) }))" />
      <BsButton v-if="roleForm.key && !team.roles.find(role => role.key === roleForm.key)?.isSystem" variant="danger" :disabled="actionPending" @click="saveRole(true)">{{ copy.archiveRole }}</BsButton>
    </BsRecordActionDialog>

    <BsRecordActionDialog v-model:visible="showTransfer" :title="copy.transfer" :dirty="transferDirty" :pending="actionPending" :error="actionError" :submit-label="copy.transfer" :cancel-label="copy.cancel" @submit="transferOwnership"><BsText size="sm">{{ copy.transferHelp }}</BsText><BsField v-slot="field" :label="copy.reason" required><BsTextarea :id="field.id" v-model="transferReason" required minlength="2" maxlength="1000" :rows="3" /></BsField></BsRecordActionDialog>
  </BsStack>
</template>
