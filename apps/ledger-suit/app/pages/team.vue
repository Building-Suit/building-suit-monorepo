<script setup lang="ts">
import type { BsAccessIdentityForm, BsAccessRoleForm, BsAccessPageCopy, BsAccessRoleView, BsAccessInvitationView, BsAccessMemberView, BsAccessMemberAction  } from '@building-suit/ui/access-presentation'
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
const sharedPermissions = computed(() => permissionRows.value.map(row => ({ key: row.capability.key, label: capabilityTitle(row.capability), section: row.section, sectionLabel: `${t(`nav.groups.${row.groupKey}`)} / ${t(`access.permissionAreas.${row.domainKey}`)}` })))
const sharedRoles = computed(() => [...roles.map(role => ({ key: role, label: t(`org.roles.${role}`) })), ...customRoles.value.map(role => ({ key: role.id, label: roleLabel(null, role.id) }))])
const memberRoleOptions = computed(() => [
  ...assignableRoles.value.map(role => ({ value: `system:${role}`, label: t(`org.roles.${role}`), description: `${rolePermissionCount(role)} / ${capabilities.value.length} ${t('access.permissionsMatrix').toLocaleLowerCase()}` })),
  ...customRoles.value.map(role => ({ value: `custom:${role.id}`, label: roleLabel(null, role.id), description: `${customPermissionCount(role.id)} / ${capabilities.value.length} ${t('access.permissionsMatrix').toLocaleLowerCase()}` })),
])
function matrixGranted(role: string, key: string) {
  return roles.includes(role as Role) ? hasRolePermission(role as Role, key) : customCapabilitiesFor(role).has(key)
}
function invitationActions(invitation: InvitationRow) {
  if (invitation.status !== 'pending') return []
  return [ ...(can('members.invite') ? [{ key: 'resend', label: t('access.resend') }] : []), ...(can('members.update') ? [{ key: 'revoke', label: t('access.revoke') }] : []) ]
}
function invitationAction(key: string, invitation: InvitationRow) {
  if (key === 'resend') return resendInvitation(invitation)
  if (key === 'revoke') return revokeInvitation(invitation)
}
const { dirty: overlayDirty0 } = useRecordAction(() => ({ role: editRoleChoice.value, status: editStatus.value }), computed(() => Boolean(editingMember.value)))
const { dirty: overlayDirty2 } = useRecordAction(() => roleForm.value, computed(() => Boolean(roleModalOpen.value)))
const ledgerUsage = useLedgerUsagePresentation()
const memberViews = computed<BsAccessMemberView[]>(() => visibleMembers.value.map(member => {
  const actions: BsAccessMemberAction[] = []
  if (can('members.update') && member.role !== 'owner') actions.push({ key: 'edit', label: t('access.editAccess') })
  if (can('members.update') && member.role !== 'owner' && member.user_id !== user.value?.id) actions.push({ key: member.status === 'active' ? 'suspend' : 'reactivate', label: t(member.status === 'active' ? 'access.suspend' : 'access.reactivate') })
  if (can('members.remove') && member.role !== 'owner' && member.user_id !== user.value?.id) actions.push({ key: 'remove', label: t('access.remove') })
  return { id: member.id, name: member.profile?.full_name || member.profile?.email || '', email: member.profile?.email || '', jobTitle: member.profile?.job_title || undefined, role: roleLabel(member.role, member.role_id), roleNote: member.granted_capabilities.length || member.revoked_capabilities.length ? t('access.customized') : undefined, status: member.status, joined: formatDate(member.joined_at), actions }
}))
function memberViewAction(key: BsAccessMemberAction['key'], id: string) {
  const member = members.value.find(row => row.id === id)
  if (!member) return
  if (key === 'edit') openEditor(member)
  else if (key === 'suspend' || key === 'reactivate') void quickStatus(member)
  else if (key === 'remove') void removeMember(member)
}
const invitationViews = computed<BsAccessInvitationView[]>(() => invitations.value.map(invitation => ({ id: invitation.id, email: invitation.email, role: roleLabel(invitation.role, invitation.role_id), status: invitation.status, sender: invitation.inviter?.full_name || '—', senderDetail: invitation.inviter?.job_title || undefined, sent: formatDate(invitation.created_at), expires: formatDate(invitation.expires_at), actions: invitationActions(invitation) })))
function invitationViewAction(key: string, id: string) {
  const invitation = invitations.value.find(row => row.id === id)
  if (invitation) invitationAction(key, invitation)
}
const accessCopy = computed<BsAccessPageCopy>(() => ({
  title: t('access.title'), subtitle: t('access.subtitle'), eyebrow: t('access.eyebrow'), members: t('access.members'), roles: t('access.roleSummary'), invitations: t('access.invitations'), noMembers: t('access.noMembers'), noInvitations: t('access.noInvitations'), search: t('access.searchMembers'), memberCount: t('access.memberCount', members.value.length), invitationCount: t('access.invitationCount', invitations.value.length), roleSummary: t('access.roleSummary'), roleSummaryHint: t('access.roleSummaryHint'), invite: t('org.invite'), newRole: t('access.newRole'), matrix: t('access.permissionsMatrix'), retry: t('common.retry'), noTeam: t('access.noMembers'),
  memberColumns: { name: t('access.name'), role: t('access.role'), status: t('access.status'), joined: t('access.joined'), actions: t('access.actions') },
  invitationColumns: { email: t('auth.email'), role: t('access.role'), status: t('access.status'), sender: t('access.invitedBy'), sent: t('access.sent'), expires: t('access.expires'), actions: t('access.actions') },
}))
const roleViews = computed<BsAccessRoleView[]>(() => [
  ...roles.map(role => ({ id: `system:${role}`, label: t(`org.roles.${role}`), description: t(`access.roles.${role}`), permissions: `${rolePermissionCount(role)} / ${capabilities.value.length} ${t('access.permissionsMatrix').toLocaleLowerCase()}`, actions: can('members.update') && role !== 'owner' ? [{ key: 'edit' as const, label: t('access.editRole') }] : [] })),
  ...customRoles.value.map(role => ({ id: `custom:${role.id}`, label: roleLabel(null, role.id), description: `${role.name_en} · ${role.name_ar}`, permissions: `${customPermissionCount(role.id)} / ${capabilities.value.length} ${t('access.permissionsMatrix').toLocaleLowerCase()}`, actions: can('members.update') ? [{ key: 'edit' as const, label: t('access.editRole') }, { key: 'remove' as const, label: t('access.remove') }] : [] })),
])
function roleViewAction(key: 'edit' | 'remove', id: string) {
  if (id.startsWith('system:')) { if (key === 'edit') openEditSystemRole(id.slice(7) as Role); return }
  const role = customRoles.value.find(row => row.id === id.slice(7))
  if (!role) return
  if (key === 'edit') openEditRole(role)
  else void deleteRole(role)
}
const invitationView = useLedgerTeamMenuView({ showTrigger: false }, () => {})
const invitationPresentationForm = computed<BsAccessIdentityForm>({ get: () => ({ name: '', jobTitle: '', email: invitationView.email.value, role: invitationView.role.value, locationIds: [] }), set: value => { invitationView.email.value = value.email; invitationView.role.value = value.role } })
const memberPresentationForm = computed<BsAccessIdentityForm>({ get: () => ({ name: '', jobTitle: '', email: editingMember.value?.profile?.email || '', role: editRoleChoice.value, locationIds: [] }), set: value => { editRoleChoice.value = value.role } })
const rolePresentationForm = computed<BsAccessRoleForm>({ get: () => ({ name: roleForm.value.name_en, nameAr: roleForm.value.name_ar, permissions: [...roleForm.value.caps] }), set: value => { roleForm.value.name_en = value.name; roleForm.value.name_ar = value.nameAr; roleForm.value.caps = new Set(value.permissions) } })
const invitationEditor = computed(() => ({ state: { visible: invitationView.open.value && can('members.invite'), title: t('org.invite'), dirty: invitationView.overlayDirty0.value, pending: invitationView.pending.value, error: invitationView.errorMessage.value, submitLabel: t('org.createInvite'), cancelLabel: t('common.cancel') }, copy: { email: t('auth.email'), role: t('team.role'), help: t('access.inviteDescription'), deliveryTitle: t('access.emailDelivery'), deliveryHint: t('access.emailDeliveryHint') }, roles: [...['admin', 'accountant', 'data_entry', 'viewer'].map(key => ({ value: `system:${key}`, label: t(`org.roles.${key}`) })), ...invitationView.customRoles.value.map(role => ({ value: `custom:${role.id}`, label: roleLabel(null, role.id) }))], usage: invitationView.ledgerUsage.item('max_members') || undefined }))
const memberEditor = computed(() => ({ state: { visible: Boolean(editingMember.value), title: t('access.editAccessFor', { name: editingMember.value?.profile?.full_name || editingMember.value?.profile?.email }), dirty: overlayDirty0.value, pending: saving.value, error: errorMessage.value, submitLabel: t('access.saveAccess'), cancelLabel: t('common.cancel') }, copy: { email: t('auth.email'), role: t('access.role') }, roles: memberRoleOptions.value }))
const roleEditor = computed(() => ({ state: { visible: roleModalOpen.value, title: roleForm.value.systemRole ? t('access.editRoleFor', { role: t(`org.roles.${roleForm.value.systemRole}`) }) : roleForm.value.id ? t('access.editRole') : t('access.newRole'), dirty: overlayDirty2.value, pending: roleSaving.value, error: errorMessage.value, submitLabel: t('access.createRole'), cancelLabel: t('common.cancel') }, names: !roleForm.value.systemRole ? { english: t('access.roleNameEn'), arabic: t('access.roleNameAr'), maxLength: 80 } : undefined, permissionLabel: t('access.permission'), permissions: sharedPermissions.value.map(permission => ({ key: permission.key, label: permission.label })), usage: !roleForm.value.id && !roleForm.value.systemRole ? ledgerUsage.item('max_custom_roles') || undefined : undefined }))
const matrixPresentation = computed(() => ({ visible: matrixOpen.value, title: t('access.permissionsMatrix'), hint: t('access.matrixHint'), permissionLabel: t('access.permission'), closeLabel: t('common.close'), items: sharedPermissions.value, roles: sharedRoles.value, granted: matrixGranted }))
</script>

<template>
  <BsAccessManagementPage
    v-model:invitation-form="invitationPresentationForm"
    v-model:member-form="memberPresentationForm"
    v-model:role-form="rolePresentationForm"
    :copy="accessCopy"
    :tabs="tabs"
    :active-tab="activeTab"
    :members="memberViews"
    :roles="roleViews"
    :invitations="invitationViews"
    :loading="loading"
    :error="errorMessage && !editingMember && !matrixOpen && !roleModalOpen ? errorMessage : null"
    :can-invite="can('members.invite')"
    :can-create-role="can('members.update')"
    :can-view-matrix="can('members.read')"
    :search="search"
    :pending="saving"
    :invitation-editor="invitationEditor"
    :member-editor="memberEditor"
    :role-editor="roleEditor"
    :matrix="matrixPresentation"
    @update:active-tab="activeTab = $event as Tab"
    @update:search="search = $event"
    @invite="showInvitation"
    @create-role="openCreateRole"
    @matrix="openMatrix"
    @retry="loadAccess"
    @member-action="memberViewAction"
    @invitation-action="invitationViewAction"
    @role-action="roleViewAction"
    @close-invitation="invitationView.close"
    @submit-invitation="invitationView.invite"
    @close-member="editingMember = null"
    @submit-member="saveMember"
    @close-role="roleModalOpen = false"
    @submit-role="saveRole"
    @close-matrix="matrixOpen = false"
  />
</template>
