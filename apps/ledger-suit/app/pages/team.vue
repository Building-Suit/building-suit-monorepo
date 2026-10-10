<script setup lang="ts">
import { useLedgerTeamMenuView } from '~/composables/useLedgerTeamMenuView'
import type { Database } from '~~/types/database.types'
const confirmation = useConfirmation()

definePageMeta({ layout: 'default' })

type Role = Database['public']['Enums']['organization_role']
type MemberStatus = Database['public']['Enums']['membership_status']
type Tab = 'members' | 'roles' | 'invitations'

interface ProfileSummary {
  email: string
  full_name: string | null
  job_title: string | null
}

interface MemberRow {
  id: string
  user_id: string
  role: Role
  role_id: string | null
  status: MemberStatus
  granted_capabilities: string[]
  revoked_capabilities: string[]
  joined_at: string
  profile: ProfileSummary | null
}

interface InvitationRow {
  id: string
  email: string
  role: Role
  role_id: string | null
  status: Database['public']['Enums']['invitation_status']
  created_at: string
  expires_at: string
  inviter: Pick<ProfileSummary, 'full_name' | 'job_title'> | null
}

interface CapabilityRow {
  key: string
  domain: string
  description: string
  description_ar: string
}

interface CustomRoleRow {
  id: string
  key: string
  name_en: string
  name_ar: string
}

const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const { current, currentId, can, loadOrganizations, roleLabel } = useTenant()
const { show: showInvitation, revision: invitationRevision } = useTeamInvitation()
const { t, locale } = useI18n()
const toasts = useToasts()
const describeError = useErrorMessage()
const { refresh: refreshPlanUsage } = usePlanUsage()

useHead({ title: () => `${t('access.title')} · ${t('app.name')}` })

const roles: Role[] = ['owner', 'admin', 'accountant', 'data_entry', 'viewer']
const assignableRoles = computed<Role[]>(() => current.value?.role === 'owner' ? roles : roles.filter(role => role !== 'owner'))
const activeTab = ref<Tab>('members')
const search = ref('')
const members = ref<MemberRow[]>([])
const invitations = ref<InvitationRow[]>([])
const capabilities = ref<CapabilityRow[]>([])
const roleCapabilities = ref<Array<{ role: Role | null, role_id: string | null, capability_key: string }>>([])
const organizationSystemRoleCapabilities = ref<Array<{ role: Role, capability_key: string }>>([])
const customRoles = ref<CustomRoleRow[]>([])
const loading = ref(true)
const errorMessage = ref('')

const tabs = computed(() => [
  { key: 'members' as const, label: t('access.members'), count: members.value.length },
  { key: 'roles' as const, label: t('access.rolesPermissions') },
  { key: 'invitations' as const, label: t('access.invitations'), count: invitations.value.filter(invitation => invitation.status === 'pending').length },
])

const visibleMembers = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return members.value
  return members.value.filter((member) => {
    const profile = member.profile
    return [profile?.full_name, profile?.email, profile?.job_title, member.role]
      .some(value => String(value ?? '').toLocaleLowerCase().includes(query))
  })
})

const PERMISSION_MENU_GROUPS = [
  { key: 'transactions', domains: ['transactions', 'attachments', 'categories', 'imports', 'opening_balances', 'exports', 'books'] },
  { key: 'ledger', domains: ['accounts'] },
  { key: 'operations', domains: ['commitments', 'recurring'] },
  { key: 'directory', domains: ['counterparties', 'tags'] },
  { key: 'workspace', domains: ['organization', 'members', 'billing', 'audit'] },
  { key: 'insights', domains: ['reports'] },
] as const

const permissionMenuGroups = computed(() => PERMISSION_MENU_GROUPS.map(group => ({
  key: group.key,
  domains: group.domains.map(domain => ({
    key: domain,
    items: capabilities.value.filter(capability => capability.domain === domain),
  })).filter(domain => domain.items.length),
})).filter(group => group.domains.length))

function capabilityTitle(capability: CapabilityRow) {
  return locale.value === 'ar' ? capability.description_ar : capability.description
}

function systemDefaultsFor(role: Role) {
  if (role === 'owner') return new Set(capabilities.value.map(capability => capability.key))
  const workspaceCapabilities = organizationSystemRoleCapabilities.value
    .filter(item => item.role === role)
    .map(item => item.capability_key)
  if (workspaceCapabilities.length) return new Set(workspaceCapabilities)
  return new Set(roleCapabilities.value.filter(item => item.role === role).map(item => item.capability_key))
}

function customCapabilitiesFor(roleId: string) {
  return new Set(roleCapabilities.value.filter(item => item.role_id === roleId).map(item => item.capability_key))
}

function rolePermissionCount(role: Role) {
  return systemDefaultsFor(role).size
}

function customPermissionCount(roleId: string) {
  return customCapabilitiesFor(roleId).size
}

function hasRolePermission(role: Role, capability: string) {
  return systemDefaultsFor(role).has(capability)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value))
}

async function loadAccess() {
  if (!currentId.value || !can('members.read')) {
    loading.value = false
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const [memberResult, invitationResult, capabilityResult, roleResult, systemRoleResult, customRoleResult] = await Promise.all([
      supabase
        .from('organization_members')
        .select('id, user_id, role, role_id, status, granted_capabilities, revoked_capabilities, joined_at, profile:profiles!organization_members_user_id_fkey(email, full_name, job_title)')
        .eq('organization_id', currentId.value)
        .order('created_at'),
      supabase
        .from('organization_invitations')
        .select('id, email, role, role_id, status, created_at, expires_at, inviter:profiles!organization_invitations_invited_by_fkey(full_name, job_title)')
        .eq('organization_id', currentId.value)
        .order('created_at', { ascending: false }),
      supabase.from('capabilities').select('key, domain, description, description_ar').order('domain').order('key'),
      supabase.from('role_capabilities').select('role, role_id, capability_key'),
      supabase.from('organization_system_role_capabilities').select('role, capability_key').eq('organization_id', currentId.value),
      supabase.from('organization_roles').select('id, key, name_en, name_ar').eq('organization_id', currentId.value).order('created_at'),
    ])
    if (memberResult.error) throw memberResult.error
    if (invitationResult.error) throw invitationResult.error
    if (capabilityResult.error) throw capabilityResult.error
    if (roleResult.error) throw roleResult.error
    if (systemRoleResult.error) throw systemRoleResult.error
    if (customRoleResult.error) throw customRoleResult.error
    members.value = (memberResult.data ?? []) as unknown as MemberRow[]
    invitations.value = (invitationResult.data ?? []) as unknown as InvitationRow[]
    capabilities.value = capabilityResult.data ?? []
    roleCapabilities.value = roleResult.data ?? []
    organizationSystemRoleCapabilities.value = systemRoleResult.data ?? []
    customRoles.value = customRoleResult.data ?? []
  }
  catch (error) { errorMessage.value = describeError(error) }
  finally { loading.value = false }
}

watch(currentId, () => void loadAccess(), { immediate: true })
watch(invitationRevision, () => void loadAccess())

// ---------------------------------------------------------------------------
// Member access editor: a role menu only. The role menu lists system roles
// plus every custom role defined in this workspace.
// ---------------------------------------------------------------------------
const editingMember = ref<MemberRow | null>(null)
const editRoleChoice = ref<string>('system:viewer')
const editStatus = ref<MemberStatus>('active')
const saving = ref(false)

const editedSystemRole = computed<Role | null>(() => editRoleChoice.value.startsWith('system:') ? editRoleChoice.value.slice(7) as Role : null)
const editedCustomRoleId = computed<string | null>(() => editRoleChoice.value.startsWith('custom:') ? editRoleChoice.value.slice(7) : null)

function openEditor(member: MemberRow) {
  editingMember.value = member
  editRoleChoice.value = member.role_id ? `custom:${member.role_id}` : `system:${member.role}`
  editStatus.value = member.status
  errorMessage.value = ''
}

async function saveMember() {
  if (!editingMember.value) return
  saving.value = true
  errorMessage.value = ''
  // Changing the role resets any per-member capability overrides to the new
  // role's defaults; keeping the same role preserves existing overrides.
  const roleChanged = editingMember.value.role_id !== editedCustomRoleId.value
    || (editedCustomRoleId.value === null && editingMember.value.role !== editedSystemRole.value)
  const granted = roleChanged ? [] : editingMember.value.granted_capabilities
  const revoked = roleChanged ? [] : editingMember.value.revoked_capabilities
  try {
    const { error } = await supabase.rpc('manage_organization_member', {
      p_member_id: editingMember.value.id,
      p_role: editedSystemRole.value ?? 'viewer',
      p_role_id: editedCustomRoleId.value ?? undefined,
      p_status: editStatus.value,
      p_granted_capabilities: granted,
      p_revoked_capabilities: revoked,
    })
    if (error) throw error
    editingMember.value = null
    await loadAccess()
    await loadOrganizations(user.value?.id, { force: true })
    toasts.success(t('access.saved'))
  }
  catch (error) { errorMessage.value = describeError(error) }
  finally { saving.value = false }
}

async function quickStatus(member: MemberRow) {
  const nextStatus: MemberStatus = member.status === 'active' ? 'suspended' : 'active'
  editingMember.value = member
  editRoleChoice.value = member.role_id ? `custom:${member.role_id}` : `system:${member.role}`
  editStatus.value = nextStatus
  await saveMember()
}

async function removeMember(member: MemberRow) {
  if (!await confirmation.ask(t('access.removeConfirm'))) return
  saving.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.rpc('remove_organization_member', { p_member_id: member.id })
    if (error) throw error
    await loadAccess()
    toasts.success(t('access.removed'))
  }
  catch (error) { errorMessage.value = describeError(error) }
  finally { saving.value = false }
}

// ---------------------------------------------------------------------------
// Permission matrix: a read-only reference for system and custom roles.
// ---------------------------------------------------------------------------
const matrixOpen = ref(false)

function openMatrix() {
  errorMessage.value = ''
  matrixOpen.value = true
}

// ---------------------------------------------------------------------------
// Custom role create/edit: bilingual names plus the permission list.
// ---------------------------------------------------------------------------
const roleModalOpen = ref(false)
const roleForm = ref<{ id: string | null, systemRole: Role | null, name_en: string, name_ar: string, caps: Set<string> }>({ id: null, systemRole: null, name_en: '', name_ar: '', caps: new Set() })
const roleSaving = ref(false)

function openCreateRole() {
  roleForm.value = { id: null, systemRole: null, name_en: '', name_ar: '', caps: new Set(['organization.read']) }
  errorMessage.value = ''
  roleModalOpen.value = true
}

function openEditRole(role: CustomRoleRow) {
  roleForm.value = { id: role.id, systemRole: null, name_en: role.name_en, name_ar: role.name_ar, caps: customCapabilitiesFor(role.id) }
  errorMessage.value = ''
  roleModalOpen.value = true
}

function openEditSystemRole(role: Role) {
  if (role === 'owner') return
  roleForm.value = { id: null, systemRole: role, name_en: '', name_ar: '', caps: systemDefaultsFor(role) }
  errorMessage.value = ''
  roleModalOpen.value = true
}

function toggleRoleCap(key: string, checked: boolean) {
  const next = new Set(roleForm.value.caps)
  if (checked) next.add(key)
  else next.delete(key)
  roleForm.value = { ...roleForm.value, caps: next }
}

function slugKey(name: string) {
  const slug = name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '_').replaceAll(/^_+|_+$/g, '').slice(0, 40)
  return slug.length >= 2 ? slug : 'role'
}

async function saveRole() {
  roleSaving.value = true
  errorMessage.value = ''
  try {
    if (roleForm.value.systemRole) {
      const { error } = await supabase.rpc('update_organization_system_role', {
        p_organization_id: currentId.value!,
        p_role: roleForm.value.systemRole,
        p_capabilities: [...roleForm.value.caps],
      })
      if (error) throw error
    }
    else if (roleForm.value.id) {
      const { error } = await supabase.rpc('update_organization_role', {
        p_role_id: roleForm.value.id,
        p_name_en: roleForm.value.name_en,
        p_name_ar: roleForm.value.name_ar,
        p_capabilities: [...roleForm.value.caps],
      })
      if (error) throw error
    }
    else {
      const { error } = await supabase.rpc('create_organization_role', {
        p_organization_id: currentId.value!,
        p_key: slugKey(roleForm.value.name_en),
        p_name_en: roleForm.value.name_en,
        p_name_ar: roleForm.value.name_ar,
        p_capabilities: [...roleForm.value.caps],
      })
      if (error) throw error
      await refreshPlanUsage()
    }
    roleModalOpen.value = false
    await loadAccess()
    await loadOrganizations(user.value?.id, { force: true })
    toasts.success(t('access.saved'))
  }
  catch (error) { errorMessage.value = describeError(error) }
  finally { roleSaving.value = false }
}

async function deleteRole(role: CustomRoleRow) {
  if (!await confirmation.ask(t('access.deleteRoleConfirm'))) return
  errorMessage.value = ''
  try {
    const { error } = await supabase.rpc('delete_organization_role', { p_role_id: role.id })
    if (error) throw error
    await loadAccess()
    toasts.success(t('access.removed'))
  }
  catch (error) { errorMessage.value = describeError(error) }
}

async function revokeInvitation(invitation: InvitationRow) {
  saving.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.rpc('revoke_organization_invitation', { p_invitation_id: invitation.id })
    if (error) throw error
    await loadAccess()
    toasts.success(t('access.revoked'))
  }
  catch (error) { errorMessage.value = describeError(error) }
  finally { saving.value = false }
}

async function resendInvitation(invitation: InvitationRow) {
  saving.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase.functions.invoke('send-invitation', { body: { invitationId: invitation.id } })
    if (error) throw new Error(await edgeFunctionErrorMessage(error, t('errors.generic')))
    if (!data?.sent) throw new Error(data?.warning ?? t('errors.generic'))
    await loadAccess()
    toasts.success(t('access.resent'))
  }
  catch (error) { errorMessage.value = describeError(error) }
  finally { saving.value = false }
}
const permissionRows = computed(() => permissionMenuGroups.value.flatMap(group => group.domains.flatMap(domain => domain.items.map(capability => ({ capability, groupKey: group.key, domainKey: domain.key, section: `${group.key}.${domain.key}` })))))
const { dirty: overlayDirty0 } = useRecordAction(() => ({ role: editRoleChoice.value, status: editStatus.value }), computed(() => Boolean(editingMember.value)))
const { dirty: overlayDirty2 } = useRecordAction(() => roleForm.value, computed(() => Boolean(roleModalOpen.value)))
const ledgerUsage = useLedgerUsagePresentation()
</script>

<template>
  <BsStack gap="lg">
    <BsInline as="header" gap="md" :wrap="true" align="end" justify="between">
      <BsBox>
        <BsText size="xs" tone="muted" emphasis="bold">{{ t('access.eyebrow') }}</BsText>
        <BsHeading :level="1" size="h1">{{ t('access.title') }}</BsHeading>
        <BsText size="sm" tone="muted">{{ t('access.subtitle') }}</BsText>
      </BsBox>
      <BsInline gap="sm" :wrap="true">
        <BsButton v-if="can('members.read')" type="button" @click="openMatrix">{{ t('access.permissionsMatrix') }}</BsButton>
        <BsButton v-if="can('members.update')" type="button" variant="primary" @click="openCreateRole"><BsIcon name="add" :size="18" /> {{ t('access.newRole') }}</BsButton>
        <BsButton v-if="can('members.invite')" type="button" variant="primary" @click="showInvitation"><BsIcon name="add" :size="18" /> {{ t('org.invite') }}</BsButton>
      </BsInline>
    </BsInline>
    <BsCard role="tablist" :aria-label="t('access.title')" as="div" padding="sm">
      <BsStack gap="xs">
        <BsButton v-for="tab in tabs" :key="tab.key" variant="tab" type="button" role="tab" :aria-selected="activeTab === tab.key" @click="activeTab = tab.key">{{ tab.label }} <BsText v-if="tab.count !== undefined" as="span">{{ tab.count }}</BsText></BsButton>
      </BsStack>
    </BsCard>
    <BsSectionSkeleton v-if="loading" variant="table" :rows="6" />
    <BsText v-else-if="errorMessage && !editingMember && !matrixOpen && !roleModalOpen" role="alert" tone="danger">{{ errorMessage }}</BsText>
    <template v-else-if="activeTab === 'members'">
      <BsInline gap="md" :wrap="true" justify="between">
        <BsText size="sm" tone="muted" emphasis="semibold">{{ t('access.memberCount', members.length) }}</BsText>
        <BsFieldLabel>
          <BsVisuallyHidden>{{ t('access.searchMembers') }}</BsVisuallyHidden>
          <BsInput v-model="search" type="search" :placeholder="t('access.searchMembers')" />
        </BsFieldLabel>
      </BsInline>
      <BsCard v-if="visibleMembers.length" as="div" padding="none">
        <BsDataTable
          :value="visibleMembers"
          row-key="id"
          :columns="[{ key: 'column1', header: (t('access.name')) }, { key: 'column2', header: (t('access.role')) }, { key: 'column3', header: (t('access.status')) }, { key: 'column4', header: (t('access.joined')) }, { key: 'column5', header: (t('access.actions')), align: 'end' as const }]"
        >
          <template #header-column1>{{ t('access.name') }}</template>
          <template #cell-column1="{ row: member }">
            <BsInline gap="md" :wrap="false">
              <BsText as="span" emphasis="bold">{{ (member.profile?.full_name || member.profile?.email || '?').slice(0, 1).toUpperCase() }}</BsText>
              <BsBox>
                <BsText emphasis="bold">{{ member.profile?.full_name || member.profile?.email }}</BsText>
                <BsText dir="ltr" size="xs" tone="muted">{{ member.profile?.email }}</BsText>
                <BsText v-if="member.profile?.job_title" size="xs" tone="muted">{{ member.profile.job_title }}</BsText>
              </BsBox>
            </BsInline>
          </template>
          <template #header-column2>{{ t('access.role') }}</template>
          <template #cell-column2="{ row: member }">
            <BsBadge>{{ roleLabel(member.role, member.role_id) }}</BsBadge>
            <BsText v-if="member.granted_capabilities.length || member.revoked_capabilities.length" as="span" size="xs" tone="muted">{{ t('access.customized') }}</BsText>
          </template>
          <template #header-column3>{{ t('access.status') }}</template>
          <template #cell-column3="{ row: member }">
            <BsStatusBadge :status="member.status" />
          </template>
          <template #header-column4>{{ t('access.joined') }}</template>
          <template #cell-column4="{ row: member }">{{ formatDate(member.joined_at) }}</template>
          <template #header-column5>{{ t('access.actions') }}</template>
          <template #cell-column5="{ row: member }">
            <BsButton v-if="can('members.update') && member.role !== 'owner'" type="button" size="sm" @click="openEditor(member)">{{ t('access.editAccess') }}</BsButton>
            <BsButton v-if="can('members.update') && member.role !== 'owner' && member.user_id !== user?.id" type="button" size="sm" @click="quickStatus(member)">{{ t(member.status === 'active' ? 'access.suspend' : 'access.reactivate') }}</BsButton>
            <BsButton v-if="can('members.remove') && member.role !== 'owner' && member.user_id !== user?.id" type="button" size="sm" @click="removeMember(member)">{{ t('access.remove') }}</BsButton>
          </template>
        </BsDataTable>
      </BsCard>
      <BsEmptyState v-else :title="t('access.noMembers')" />
    </template>
    <template v-else-if="activeTab === 'roles'">
      <BsBox>
        <BsHeading :level="2" size="h3">{{ t('access.roleSummary') }}</BsHeading>
        <BsText size="sm" tone="muted">{{ t('access.roleSummaryHint') }}</BsText>
      </BsBox>
      <BsGrid :columns="4" gap="md">
        <BsCard v-for="role in roles" :key="role" padding="md">
          <BsInline gap="sm" :wrap="false" align="start" justify="between">
            <BsText as="span">
              <BsIcon :name="role === 'viewer' ? 'user' : 'team'" />
            </BsText>
            <BsButton v-if="can('members.update') && role !== 'owner'" type="button" size="sm" @click="openEditSystemRole(role)">{{ t('access.editRole') }}</BsButton>
          </BsInline>
          <BsHeading :level="3" size="body">{{ t(`org.roles.${role}`) }}</BsHeading>
          <BsText size="sm" tone="muted">{{ t(`access.roles.${role}`) }}</BsText>
          <BsText size="xs" tone="muted" emphasis="bold">{{ rolePermissionCount(role) }} / {{ capabilities.length }} {{ t('access.permissionsMatrix').toLocaleLowerCase() }}</BsText>
        </BsCard>
        <BsCard v-for="role in customRoles" :key="role.id" padding="md">
          <BsInline gap="sm" :wrap="false" align="start" justify="between">
            <BsText as="span">
              <BsIcon name="team" />
            </BsText>
            <BsInline v-if="can('members.update')" gap="xs" :wrap="false">
              <BsButton type="button" size="sm" @click="openEditRole(role)">{{ t('access.editRole') }}</BsButton>
              <BsButton type="button" size="sm" @click="deleteRole(role)">{{ t('access.remove') }}</BsButton>
            </BsInline>
          </BsInline>
          <BsHeading :level="3" size="body">{{ roleLabel(null, role.id) }}</BsHeading>
          <BsText dir="ltr" size="xs" tone="muted">{{ role.name_en }} · {{ role.name_ar }}</BsText>
          <BsText size="xs" tone="muted" emphasis="bold">{{ customPermissionCount(role.id) }} / {{ capabilities.length }} {{ t('access.permissionsMatrix').toLocaleLowerCase() }}</BsText>
        </BsCard>
      </BsGrid>
    </template>
    <template v-else>
      <BsText size="sm" tone="muted" emphasis="semibold">{{ t('access.invitationCount', invitations.length) }}</BsText>
      <BsCard v-if="invitations.length" as="div" padding="none">
        <BsDataTable
          :value="invitations"
          row-key="id"
          :columns="[{ key: 'column1', header: (t('auth.email')) }, { key: 'column2', header: (t('access.role')) }, { key: 'column3', header: (t('access.status')) }, { key: 'column4', header: (t('access.invitedBy')) }, { key: 'column5', header: (t('access.sent')) }, { key: 'column6', header: (t('access.expires')) }, { key: 'column7', header: (t('access.actions')), align: 'end' as const }]"
        >
          <template #header-column1>{{ t('auth.email') }}</template>
          <template #cell-column1="{ row: invitation }">
            <BsBox dir="ltr">{{ invitation.email }}</BsBox>
          </template>
          <template #header-column2>{{ t('access.role') }}</template>
          <template #cell-column2="{ row: invitation }">{{ roleLabel(invitation.role, invitation.role_id) }}</template>
          <template #header-column3>{{ t('access.status') }}</template>
          <template #cell-column3="{ row: invitation }">
            <BsStatusBadge :status="invitation.status" />
          </template>
          <template #header-column4>{{ t('access.invitedBy') }}</template>
          <template #cell-column4="{ row: invitation }">
            <BsText>{{ invitation.inviter?.full_name || '—' }}</BsText>
            <BsText v-if="invitation.inviter?.job_title" size="xs" tone="muted">{{ invitation.inviter.job_title }}</BsText>
          </template>
          <template #header-column5>{{ t('access.sent') }}</template>
          <template #cell-column5="{ row: invitation }">{{ formatDate(invitation.created_at) }}</template>
          <template #header-column6>{{ t('access.expires') }}</template>
          <template #cell-column6="{ row: invitation }">{{ formatDate(invitation.expires_at) }}</template>
          <template #header-column7>{{ t('access.actions') }}</template>
          <template #cell-column7="{ row: invitation }">
            <template v-if="invitation.status === 'pending'">
              <BsButton v-if="can('members.invite')" type="button" :disabled="saving" size="sm" @click="resendInvitation(invitation)">{{ t('access.resend') }}</BsButton>
              <BsButton v-if="can('members.update')" type="button" :disabled="saving" size="sm" @click="revokeInvitation(invitation)">{{ t('access.revoke') }}</BsButton>
            </template>
          </template>
        </BsDataTable>
      </BsCard>
      <BsEmptyState v-else :title="t('access.noInvitations')" />
    </template>
    <BsWorkflowScope :factory="useLedgerTeamMenuView" :input="{ showTrigger: (false) }">
      <template #default="{ state: ledgerView20 }">
        <BsBox v-if="ledgerView20.can('members.invite')">
          <BsButton v-if="ledgerView20.showTrigger" type="button" size="sm" block @click="ledgerView20.show">{{ ledgerView20.t('org.invite') }}</BsButton>
          <BsRecordActionDialog
            v-if="ledgerView20.open"
            :visible="true"
            :title="ledgerView20.t('org.invite')"
            size="md"
            :dirty="ledgerView20.overlayDirty0"
            :pending="ledgerView20.pending"
            :error="ledgerView20.errorMessage"
            :submit-label="ledgerView20.t('org.createInvite')"
            :cancel-label="ledgerView20.t('common.cancel')"
            @update:visible="(value: boolean) => { if (!value) ledgerView20.close() }"
            @submit="ledgerView20.invite"
          >
            <BsText size="sm" tone="muted">{{ ledgerView20.t('access.inviteDescription') }}</BsText>
            <BsUsageMeter v-if="ledgerView20.ledgerUsage.item('max_members')" compact :item="ledgerView20.ledgerUsage.item('max_members')!" />
            <BsFloatingField :label="ledgerView20.t('auth.email')">
              <BsInput v-model="ledgerView20.email" type="email" :placeholder="ledgerView20.t('auth.email')" autocomplete="email" dir="ltr" required />
            </BsFloatingField>
            <BsFloatingField :label="ledgerView20.t('team.role')">
              <BsSelect v-model="ledgerView20.role" native>
                <BsSelectOption v-for="key in ['admin','accountant','data_entry','viewer']" :key="key" :value="`system:${key}`">{{ ledgerView20.t(`org.roles.${key}`) }}</BsSelectOption>
                <BsSelectOption v-for="custom in ledgerView20.customRoles" :key="custom.id" :value="`custom:${custom.id}`">{{ ledgerView20.roleLabel(null, custom.id) }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsInline gap="md" :wrap="false" align="start" padding="lg" surface="muted" radius="control">
              <BsIcon name="mail" />
              <BsBox>
                <BsText size="sm" emphasis="bold">{{ ledgerView20.t('access.emailDelivery') }}</BsText>
                <BsText size="xs" tone="muted">{{ ledgerView20.t('access.emailDeliveryHint') }}</BsText>
              </BsBox>
            </BsInline>
          </BsRecordActionDialog>
        </BsBox>
      </template>
    </BsWorkflowScope>
    <!-- Edit access: role menu only -->
    <BsRecordActionDialog
      v-if="editingMember"
      :visible="true"
      :title="t('access.editAccessFor', { name: editingMember.profile?.full_name || editingMember.profile?.email })"
      size="lg"
      :dirty="overlayDirty0"
      :pending="saving"
      :error="errorMessage"
      :submit-label="t('access.saveAccess')"
      :cancel-label="t('common.cancel')"
      @update:visible="(value: boolean) => { if (!value) editingMember = null }"
      @submit="saveMember"
    >
      <BsText dir="ltr" size="sm" tone="muted">{{ editingMember.profile?.email }}</BsText>
      <BsFieldGroup>
        <template #legend>{{ t('access.role') }}</template>
        <BsGrid :columns="1" gap="sm">
          <BsFieldLabel v-for="role in assignableRoles" :key="role">
            <BsInline as="span" gap="md" :wrap="false">
              <BsRadio v-model="editRoleChoice" name="edit-member-role" :value="`system:${role}`" bare />
              <BsText as="span" emphasis="bold">{{ t(`org.roles.${role}`) }}</BsText>
            </BsInline>
            <BsText as="span" size="xs" tone="muted">{{ rolePermissionCount(role) }} / {{ capabilities.length }} {{ t('access.permissionsMatrix').toLocaleLowerCase() }}</BsText>
          </BsFieldLabel>
          <BsFieldLabel v-for="role in customRoles" :key="role.id">
            <BsInline as="span" gap="md" :wrap="false">
              <BsRadio v-model="editRoleChoice" name="edit-member-role" :value="`custom:${role.id}`" bare />
              <BsText as="span" emphasis="bold">{{ roleLabel(null, role.id) }}</BsText>
            </BsInline>
            <BsText as="span" size="xs" tone="muted">{{ customPermissionCount(role.id) }} / {{ capabilities.length }} {{ t('access.permissionsMatrix').toLocaleLowerCase() }}</BsText>
          </BsFieldLabel>
        </BsGrid>
      </BsFieldGroup>
    </BsRecordActionDialog>
    <!-- Permission matrix -->
    <BsDialog
      v-if="matrixOpen"
      :visible="true"
      :title="t('access.permissionsMatrix')"
      :aria-label="t('access.permissionsMatrix')"
      :show-header="false"
      size="lg"
      :pending="saving"
      @update:visible="(value: boolean) => { if (!value) matrixOpen = false }"
    >
      <template #default="{ close: dismiss }">
        <BsBox padding="lg">
          <BsInline gap="md" :wrap="false" align="start" justify="between">
            <BsBox>
              <BsHeading :level="2" size="h3">{{ t('access.permissionsMatrix') }}</BsHeading>
              <BsText size="sm" tone="muted">{{ t('access.matrixHint') }}</BsText>
            </BsBox>
            <BsButton type="button" :aria-label="t('common.close')" size="sm" @click="dismiss">
              <BsIcon name="close" />
            </BsButton>
          </BsInline>
          <BsBox>
            <BsDataTable
              :value="permissionRows"
              row-group-mode="subheader"
              group-rows-by="section"
              :columns="[{ key: 'column1', header: t('access.permission') }, ...(roles ?? []).map((role) => ({ key: role, header: t(`org.roles.${role}`), align: 'center' as const })), ...(customRoles ?? []).map((role) => ({ key: role.id, header: roleLabel(null, role.id), align: 'center' as const }))]"
            >
              <template #cell-column1="{ row }">
                <BsText emphasis="semibold">{{ capabilityTitle(row.capability) }}</BsText>
              </template>
              <template v-for="role in roles" :key="role" #[`cell-${role}`]="{ row }">
                <BsIcon v-if="hasRolePermission(role, row.capability.key)" name="check" :size="18" />
                <BsText v-else as="span" tone="muted">—</BsText>
              </template>
              <template v-for="role in customRoles" :key="role.id" #[`cell-${role.id}`]="{ row }">
                <BsIcon v-if="customCapabilitiesFor(role.id).has(row.capability.key)" name="check" :size="18" />
                <BsText v-else as="span" tone="muted">—</BsText>
              </template>
              <template #groupheader="{ data: row }">
                <BsBox surface="muted">{{ t(`nav.groups.${row.groupKey}`) }} / {{ t(`access.permissionAreas.${row.domainKey}`) }}</BsBox>
              </template>
            </BsDataTable>
          </BsBox>
        </BsBox>
      </template>
    </BsDialog>
    <!-- Create / edit custom role -->
    <BsRecordActionDialog
      v-if="roleModalOpen"
      :visible="true"
      :title="roleForm.systemRole ? t('access.editRoleFor', { role: t(`org.roles.${roleForm.systemRole}`) }) : roleForm.id ? t('access.editRole') : t('access.newRole')"
      size="lg"
      :dirty="overlayDirty2"
      :pending="roleSaving"
      :error="errorMessage"
      :submit-label="t('access.createRole')"
      :cancel-label="t('common.cancel')"
      @update:visible="(value: boolean) => { if (!value) roleModalOpen = false }"
      @submit="saveRole"
    >
      <BsUsageMeter
        v-if="(!roleForm.id && !roleForm.systemRole) && ledgerUsage.item('max_custom_roles')"
        compact
        :item="ledgerUsage.item('max_custom_roles')!"
      />
      <BsGrid v-if="!roleForm.systemRole" :columns="2" gap="md">
        <BsFloatingField :label="t('access.roleNameEn')">
          <BsInput v-model="roleForm.name_en" type="text" dir="ltr" required maxlength="80" />
        </BsFloatingField>
        <BsFloatingField :label="t('access.roleNameAr')">
          <BsInput v-model="roleForm.name_ar" type="text" dir="rtl" required maxlength="80" />
        </BsFloatingField>
      </BsGrid>
      <BsBox>
        <BsDataTable :value="permissionRows" row-group-mode="subheader" group-rows-by="section" :columns="[{ key: 'column1', header: t('access.permission') }]">
          <template #cell-column1="{ row }">
            <BsFieldLabel>
              <BsCheckbox
                :checked="roleForm.caps.has(row.capability.key)"
                bare
                @native-change="toggleRoleCap(row.capability.key, ($event.target as HTMLInputElement).checked)"
              />
              <BsText as="span" emphasis="semibold">{{ capabilityTitle(row.capability) }}</BsText>
            </BsFieldLabel>
          </template>
          <template #groupheader="{ data: row }">
            <BsBox surface="muted">{{ t(`nav.groups.${row.groupKey}`) }} / {{ t(`access.permissionAreas.${row.domainKey}`) }}</BsBox>
          </template>
        </BsDataTable>
      </BsBox>
    </BsRecordActionDialog>
  </BsStack>
</template>

undefined
