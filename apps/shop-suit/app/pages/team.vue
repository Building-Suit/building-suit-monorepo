<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { TeamMember, TeamSnapshot } from '~/types/team'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const route = useRoute()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const { current, currentId, currentMembership, loading: shopLoading, reload } = useShop()
const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const isArabic = computed(() => locale.value === 'ar')
const inviteCode = computed(() => typeof route.query.invite === 'string' ? route.query.invite : '')
const accepting = ref(false)
const acceptError = ref('')
const actionError = ref('')
const actionPending = ref(false)
const invitationLink = ref('')
const showInvite = ref(false)
const showEdit = ref(false)
const showTransfer = ref(false)
const selectedMember = ref<TeamMember | null>(null)
const inviteForm = reactive({ name: '', email: '', roleKey: 'staff', locationIds: [] as string[] })
const editForm = reactive({ roleKey: 'staff', locationIds: [] as string[] })
const transferReason = ref('')

const copy = computed(() => isArabic.value ? {
  title: 'الفريق والصلاحيات', subtitle: 'ادعُ الموظفين وحدد الدور والفروع المسموح بها وأوقف الوصول دون حذف السجل.',
  invite: 'إضافة أو دعوة موظف', inviteTitle: 'إضافة عضو للفريق', name: 'الاسم', email: 'البريد الإلكتروني', role: 'الدور', locations: 'الفروع', permissions: 'الصلاحيات', status: 'الحالة', actions: 'الإجراءات',
  manager: 'مدير', cashier: 'كاشير', barber: 'حلاق / مقدم خدمة', staff: 'موظف', owner: 'المالك',
  active: 'نشط', suspended: 'موقوف', removed: 'مزال', invited: 'مدعو', pending: 'بانتظار القبول', accepted: 'مقبولة', expired: 'منتهية', revoked: 'ملغاة',
  save: 'حفظ', saving: 'جارٍ الحفظ…', cancel: 'إلغاء', edit: 'تعديل الدور والفروع', suspend: 'إيقاف', reactivate: 'إعادة التفعيل', remove: 'إزالة', transfer: 'نقل الملكية',
  acceptTitle: 'دعوة للانضمام إلى فريق', acceptHelp: 'اقبل الدعوة بالحساب الذي يطابق البريد المدعو.', accept: 'قبول الدعوة', accepting: 'جارٍ القبول…',
  noTeam: 'لا يوجد أعضاء فريق بعد.', invitations: 'الدعوات', noInvitations: 'لا توجد دعوات.', audit: 'سجل إدارة الفريق', noAudit: 'لا توجد إجراءات مسجلة.',
  reason: 'سبب نقل الملكية', transferHelp: 'سيصبح العضو المحدد مالكًا، ويتحول المالك الحالي إلى مدير. تظل كل السجلات محفوظة.',
  chooseLocation: 'اختر فرعًا واحدًا على الأقل.', invitationReady: 'تم إنشاء الدعوة. شارك الرابط التالي بأمان مع الموظف:', added: 'تمت إضافة العضو.', updated: 'تم تحديث عضو الفريق.', acceptedInvite: 'تم قبول الدعوة.',
  loadError: 'تعذّر تحميل الفريق.', actionFailed: 'تعذّر تنفيذ الإجراء. تحقق من الصلاحيات وحاول مرة أخرى.', permissionDenied: 'لا تملك صلاحية عرض الفريق.',
  confirmSuspend: 'إيقاف هذا العضو فورًا؟ ستُرفض عملياته المحمية الحالية والجديدة.', confirmRemove: 'إزالة هذا العضو؟ سيُحظر الوصول مع الاحتفاظ بسجل النشاط.', confirmTransfer: 'تأكيد نقل الملكية؟ لا يمكن ترك النشاط بلا مالك نشط.',
  revoke: 'إلغاء الدعوة', confirmRevoke: 'إلغاء هذه الدعوة؟ لن يعود رابط القبول صالحًا.',
  date: 'التاريخ', action: 'الإجراء', actor: 'المنفذ', member: 'العضو', retry: 'إعادة المحاولة', close: 'إغلاق',
} : {
  title: 'Team & permissions', subtitle: 'Invite staff, assign roles and locations, and stop access without deleting history.',
  invite: 'Add or invite staff', inviteTitle: 'Add a team member', name: 'Name', email: 'Email', role: 'Role', locations: 'Locations', permissions: 'Permissions', status: 'Status', actions: 'Actions',
  manager: 'Manager', cashier: 'Cashier', barber: 'Barber / operator', staff: 'Staff', owner: 'Owner',
  active: 'Active', suspended: 'Suspended', removed: 'Removed', invited: 'Invited', pending: 'Pending', accepted: 'Accepted', expired: 'Expired', revoked: 'Revoked',
  save: 'Save', saving: 'Saving…', cancel: 'Cancel', edit: 'Edit role & locations', suspend: 'Suspend', reactivate: 'Reactivate', remove: 'Remove', transfer: 'Transfer ownership',
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
  members: [], roles: [], locations: [], invitations: [], events: [],
})

const { data: team, pending, error, refresh } = useAsyncData(
  'shop-data:team',
  async (): Promise<TeamSnapshot> => {
    if (!currentId.value) return emptySnapshot()
    const { data, error: readError } = await shopRpc.rpc('shop_team_read', { p_shop_id: currentId.value })
    if (readError) throw readError
    return data as TeamSnapshot
  },
  { watch: [currentId], default: emptySnapshot },
)

const activeLocations = computed(() => team.value.locations.filter(location => location.status === 'active'))
const isOwner = computed(() => currentMembership.value?.role === 'owner')

function roleLabel(key: string) {
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
    permissions: 'الصلاحيات', cost_profit: 'التكلفة والربح',
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
  Object.assign(inviteForm, { name: '', email: '', roleKey: 'staff', locationIds: [] })
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
  editForm.roleKey = member.roleKey === 'owner' ? 'manager' : member.roleKey
  editForm.locationIds = [...member.locationIds]
  actionError.value = ''
  showEdit.value = true
}

async function sendInvite() {
  if (!currentId.value || actionPending.value || !team.value.canManage) return
  if (!inviteForm.locationIds.length) { actionError.value = copy.value.chooseLocation; return }
  actionPending.value = true
  actionError.value = ''
  invitationLink.value = ''
  try {
    const { data, error: commandError } = await shopRpc.rpc('invite_shop_member', {
      p_request_id: crypto.randomUUID(), p_shop_id: currentId.value,
      p_email: inviteForm.email.trim(), p_display_name: inviteForm.name.trim() || null,
      p_role_key: inviteForm.roleKey, p_location_ids: inviteForm.locationIds,
    })
    if (commandError) throw commandError
    const result = data as { kind: 'added' | 'invited'; invitationCode?: string }
    if (result.kind === 'invited' && result.invitationCode) {
      invitationLink.value = `${window.location.origin}/team?invite=${result.invitationCode}`
    } else {
      pushToast({ tone: 'success', title: copy.value.added })
      showInvite.value = false
    }
    await refresh()
  } catch { actionError.value = copy.value.actionFailed }
  finally { actionPending.value = false }
}

async function saveMember() {
  const member = selectedMember.value
  if (!member || !currentId.value || actionPending.value) return
  if (!editForm.locationIds.length) { actionError.value = copy.value.chooseLocation; return }
  actionPending.value = true
  actionError.value = ''
  try {
    if (team.value.canManagePermissions && editForm.roleKey !== member.roleKey) {
      const { error: roleError } = await shopRpc.rpc('manage_shop_member', {
        p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_membership_id: member.id,
        p_action: 'change_role', p_role_key: editForm.roleKey,
      })
      if (roleError) throw roleError
    }
    const previous = [...member.locationIds].sort().join(',')
    const next = [...editForm.locationIds].sort().join(',')
    if (next !== previous) {
      const { error: locationError } = await shopRpc.rpc('manage_shop_member', {
        p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_membership_id: member.id,
        p_action: 'assign_locations', p_location_ids: editForm.locationIds,
      })
      if (locationError) throw locationError
    }
    showEdit.value = false
    await refresh()
    pushToast({ tone: 'success', title: copy.value.updated })
  } catch { actionError.value = copy.value.actionFailed }
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
  } catch { actionError.value = copy.value.actionFailed }
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
    const { error: commandError } = await shopRpc.rpc('accept_shop_invitation', {
      p_request_id: crypto.randomUUID(), p_invitation_code: inviteCode.value,
    })
    if (commandError) throw commandError
    await navigateTo('/team', { replace: true })
    await reload()
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <div class="space-y-6">
    <section v-if="inviteCode" class="rounded-2xl border border-[var(--bs-status-info)]/30 bg-[var(--bs-status-info-bg)] p-5">
      <h1 class="text-xl font-extrabold">{{ copy.acceptTitle }}</h1>
      <p class="mt-2 text-sm">{{ copy.acceptHelp }}</p>
      <p v-if="acceptError" role="alert" class="mt-3 text-sm text-[var(--bs-status-error)]">{{ acceptError }}</p>
      <BsButton class="mt-4" :pending="accepting" @click="acceptInvitation">{{ accepting ? copy.accepting : copy.accept }}</BsButton>
    </section>

    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div>
      <BsButton v-if="current && team.canManage" @click="openInvite">{{ copy.invite }}</BsButton>
    </header>

    <p v-if="shopLoading || pending" role="status" class="rounded-xl border border-border bg-card p-5">…</p>
    <div v-else-if="error" role="alert" class="ls-error">{{ copy.permissionDenied }} <BsButton @click="refresh()">{{ copy.retry }}</BsButton></div>
    <p v-else-if="!current" class="rounded-xl border border-border bg-card p-6 text-center text-sm">{{ copy.noTeam }}</p>
    <template v-else>
      <p v-if="actionError" role="alert" class="rounded-xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] p-4 text-sm">{{ actionError }}</p>
      <section class="overflow-x-auto rounded-2xl border border-border bg-card">
        <BsDataTable :value="team.members" data-key="id" :label="copy.title" :row-class="() => 'border-t border-border'">
          <Column header-class="px-4 py-3 text-start" body-class="px-4 py-4"><template #header>{{ copy.member }}</template><template #body="{ data: member }"><p class="font-bold">{{ memberName(member) }}</p><p class="text-xs text-muted-foreground">{{ member.email || '—' }}</p></template></Column>
          <Column header-class="px-4 py-3 text-start" body-class="px-4 py-4"><template #header>{{ copy.role }}</template><template #body="{ data: member }">{{ roleLabel(member.roleKey) }}</template></Column>
          <Column header-class="px-4 py-3 text-start" body-class="px-4 py-4"><template #header>{{ copy.locations }}</template><template #body="{ data: member }">{{ member.roleKey === 'owner' ? activeLocations.map(location => location.name).join(', ') : locationNames(member.locationIds) }}</template></Column>
          <Column header-class="px-4 py-3 text-start" body-class="px-4 py-4"><template #header>{{ copy.status }}</template><template #body="{ data: member }"><StatusBadge :status="member.status" /> <span class="ms-1 text-sm">{{ statusLabel(member.status) }}</span></template></Column>
          <Column v-if="team.canManage" header-class="px-4 py-3 text-end" body-class="px-4 py-4 text-end"><template #header>{{ copy.actions }}</template><template #body="{ data: member }"><div v-if="member.roleKey !== 'owner' && member.status !== 'removed'" class="flex flex-wrap justify-end gap-2"><BsButton size="small" severity="secondary" @click="openEdit(member)">{{ copy.edit }}</BsButton><BsButton v-if="member.status === 'active'" size="small" severity="secondary" @click="memberAction(member, 'suspend')">{{ copy.suspend }}</BsButton><BsButton v-else size="small" severity="secondary" @click="memberAction(member, 'reactivate')">{{ copy.reactivate }}</BsButton><BsButton size="small" severity="danger" @click="memberAction(member, 'remove')">{{ copy.remove }}</BsButton><BsButton v-if="isOwner && member.status === 'active'" size="small" @click="openTransfer(member)">{{ copy.transfer }}</BsButton></div></template></Column>
          <template #empty><p class="p-8 text-center text-sm text-muted-foreground">{{ copy.noTeam }}</p></template>
        </BsDataTable>
      </section>

      <section class="rounded-2xl border border-border bg-card p-5">
        <h2 class="text-lg font-extrabold">{{ copy.permissions }}</h2>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article v-for="role in team.roles" :key="role.key" class="rounded-xl border border-border p-4">
            <h3 class="font-bold">{{ roleLabel(role.key) }}</h3>
            <ul class="mt-3 flex flex-wrap gap-1.5" :aria-label="`${copy.permissions}: ${roleLabel(role.key)}`">
              <li v-for="permission in role.permissionKeys" :key="permission" class="rounded-full bg-muted px-2 py-1 text-xs">{{ permissionLabel(permission) }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section v-if="team.canManage" class="overflow-hidden rounded-2xl border border-border bg-card"><h2 class="p-5 text-lg font-extrabold">{{ copy.invitations }}</h2><BsDataTable :value="team.invitations" data-key="id" :label="copy.invitations"><Column field="email"><template #header>{{ copy.email }}</template></Column><Column><template #header>{{ copy.role }}</template><template #body="{ data: invitation }">{{ roleLabel(invitation.roleKey) }}</template></Column><Column><template #header>{{ copy.status }}</template><template #body="{ data: invitation }">{{ statusLabel(invitation.status) }}</template></Column><Column><template #header>{{ copy.date }}</template><template #body="{ data: invitation }">{{ formatDate(invitation.createdAt) }}</template></Column><Column><template #header>{{ copy.actions }}</template><template #body="{ data: invitation }"><BsButton v-if="invitation.status === 'pending'" size="small" severity="secondary" :disabled="actionPending" @click="revokeInvitation(invitation.id)">{{ copy.revoke }}</BsButton></template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.noInvitations }}</p></template></BsDataTable></section>

      <section v-if="team.canViewAudit" class="overflow-hidden rounded-2xl border border-border bg-card"><h2 class="p-5 text-lg font-extrabold">{{ copy.audit }}</h2><BsDataTable :value="team.events" data-key="id" :label="copy.audit"><Column field="action"><template #header>{{ copy.action }}</template></Column><Column field="actorEmail"><template #header>{{ copy.actor }}</template></Column><Column field="reason"><template #header>{{ copy.reason }}</template></Column><Column><template #header>{{ copy.date }}</template><template #body="{ data: event }">{{ formatDate(event.occurredAt) }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.noAudit }}</p></template></BsDataTable></section>
    </template>

    <BsDialog v-model:visible="showInvite" :title="copy.inviteTitle" :pending="actionPending">
      <BsForm class="grid gap-4" :pending="actionPending" :error="actionError" @submit="sendInvite">
        <label class="grid gap-1 text-sm font-bold">{{ copy.name }}<input v-model="inviteForm.name" class="ls-input" maxlength="160"></label>
        <label class="grid gap-1 text-sm font-bold">{{ copy.email }}<input v-model="inviteForm.email" type="email" class="ls-input" required maxlength="254"></label>
        <label class="grid gap-1 text-sm font-bold">{{ copy.role }}<select v-model="inviteForm.roleKey" class="ls-select"><option v-for="role in team.roles" :key="role.key" :value="role.key" :disabled="role.key === 'manager' && !team.canManagePermissions">{{ roleLabel(role.key) }}</option></select></label>
        <fieldset><legend class="text-sm font-bold">{{ copy.locations }}</legend><label v-for="location in activeLocations" :key="location.id" class="mt-2 flex items-center gap-2 text-sm"><input v-model="inviteForm.locationIds" type="checkbox" :value="location.id">{{ location.name }}</label></fieldset>
        <p v-if="invitationLink" role="status" class="rounded-xl bg-muted p-3 text-sm"><strong>{{ copy.invitationReady }}</strong><input :value="invitationLink" readonly class="ls-input mt-2" @focus="($event.target as HTMLInputElement).select()"></p>
        <div class="flex gap-2"><BsButton type="submit" :pending="actionPending">{{ actionPending ? copy.saving : copy.save }}</BsButton><BsButton type="button" severity="secondary" @click="showInvite = false">{{ invitationLink ? copy.close : copy.cancel }}</BsButton></div>
      </BsForm>
    </BsDialog>

    <BsDialog v-model:visible="showEdit" :title="copy.edit" :pending="actionPending">
      <BsForm class="grid gap-4" :pending="actionPending" :error="actionError" @submit="saveMember">
        <label class="grid gap-1 text-sm font-bold">{{ copy.role }}<select v-model="editForm.roleKey" class="ls-select" :disabled="!team.canManagePermissions"><option v-for="role in team.roles" :key="role.key" :value="role.key">{{ roleLabel(role.key) }}</option></select></label>
        <fieldset><legend class="text-sm font-bold">{{ copy.locations }}</legend><label v-for="location in activeLocations" :key="location.id" class="mt-2 flex items-center gap-2 text-sm"><input v-model="editForm.locationIds" type="checkbox" :value="location.id">{{ location.name }}</label></fieldset>
        <div class="flex gap-2"><BsButton type="submit" :pending="actionPending">{{ actionPending ? copy.saving : copy.save }}</BsButton><BsButton type="button" severity="secondary" @click="showEdit = false">{{ copy.cancel }}</BsButton></div>
      </BsForm>
    </BsDialog>

    <BsDialog v-model:visible="showTransfer" :title="copy.transfer" :pending="actionPending">
      <BsForm class="grid gap-4" :pending="actionPending" :error="actionError" @submit="transferOwnership"><p class="text-sm">{{ copy.transferHelp }}</p><label class="grid gap-1 text-sm font-bold">{{ copy.reason }}<textarea v-model="transferReason" class="ls-input" required minlength="2" maxlength="1000" rows="3" /></label><div class="flex gap-2"><BsButton type="submit" :pending="actionPending">{{ copy.transfer }}</BsButton><BsButton type="button" severity="secondary" @click="showTransfer = false">{{ copy.cancel }}</BsButton></div></BsForm>
    </BsDialog>
  </div>
</template>
