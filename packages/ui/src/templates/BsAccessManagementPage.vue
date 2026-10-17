<script setup lang="ts">
import type { BsAccessMemberView, BsAccessMemberAction, BsAccessInvitationView, BsAccessRoleView, BsAccessAuditView, BsAccessPageCopy, BsAccessEditorState, BsAccessIdentityForm, BsAccessIdentityCopy, BsAccessRoleForm } from '../types/accessPresentation'
import type { BsUsageItem } from '@building-suit/contracts'
import type { BsPermissionItem, BsPermissionRole } from '@building-suit/ux'
const invitationForm = defineModel<BsAccessIdentityForm>('invitationForm', { default: () => ({ name: '', jobTitle: '', email: '', role: '', locationIds: [] }) })
const memberForm = defineModel<BsAccessIdentityForm>('memberForm', { default: () => ({ name: '', jobTitle: '', email: '', role: '', locationIds: [] }) })
const roleForm = defineModel<BsAccessRoleForm>('roleForm', { default: () => ({ name: '', nameAr: '', permissions: [] }) })
const transferReason = defineModel<string>('transferReason', { default: '' })
const props = withDefaults(defineProps<{
  invitationEditor?: { state: BsAccessEditorState; copy: BsAccessIdentityCopy; roles: { value: string; label: string; disabled?: boolean }[]; locations?: { id: string; name: string }[]; link?: string; usage?: BsUsageItem; grantOptions?: { key: string; label: string }[] }
  memberEditor?: { state: BsAccessEditorState; copy: BsAccessIdentityCopy; roles: { value: string; label: string; description?: string; disabled?: boolean }[]; locations?: { id: string; name: string }[]; roleDisabled?: boolean; grantOptions?: { key: string; label: string }[] }
  roleEditor?: { state: BsAccessEditorState; names?: { english: string; arabic: string; maxLength: number; minLength?: number }; permissionLabel: string; permissions: { key: string; label: string; disabled?: boolean; section?: string; sectionLabel?: string }[]; archiveLabel?: string; usage?: BsUsageItem }
  matrix?: { visible: boolean; title: string; hint: string; permissionLabel: string; closeLabel: string; items: BsPermissionItem[]; roles: BsPermissionRole[]; grants: { role: string; permissions: string[] }[] }
  transferEditor?: { state: BsAccessEditorState; help: string; reasonLabel: string }
  confirmationEditor?: { state: BsAccessEditorState; description: string }
  acceptance?: { title: string; help: string; error: string; pending: boolean; actionLabel: string }
  copy: BsAccessPageCopy
  tabs: { key: string; label: string; count?: number; disabled?: boolean }[]
  activeTab: string
  members: BsAccessMemberView[]
  roles: BsAccessRoleView[]
  invitations: BsAccessInvitationView[]
  audit?: BsAccessAuditView[]
  loading?: boolean
  error?: string | null
  actionError?: string | null
  available?: boolean
  pending?: boolean
  canInvite?: boolean
  canCreateRole?: boolean
  canViewMatrix?: boolean
  search?: string
  statusFilter?: string
  statusOptions?: { value: string; label: string }[]
  statusLabel?: string
  pagination?: { page: number; size: number; total: number; label: string; previous: string; next: string }
}>(), { available: true, invitationEditor: undefined, memberEditor: undefined, roleEditor: undefined, matrix: undefined, transferEditor: undefined, confirmationEditor: undefined, acceptance: undefined, audit: undefined, loading: false, error: null, actionError: null, pending: false, canInvite: false, canCreateRole: false, canViewMatrix: false, search: undefined, statusFilter: undefined, statusOptions: undefined, statusLabel: undefined, pagination: undefined })
const emit = defineEmits<{
  'update:activeTab': [value: string]
  'update:search': [value: string]
  'update:statusFilter': [value: string]
  accept: []
  closeInvitation: []
  submitInvitation: []
  closeMember: []
  submitMember: []
  closeRole: []
  submitRole: []
  archiveRole: []
  closeMatrix: []
  closeTransfer: []
  submitTransfer: []
  closeConfirmation: []
  confirm: []
  invite: []
  createRole: []
  matrix: []
  retry: []
  page: [value: number]
  memberAction: [key: BsAccessMemberAction['key'], id: string]
  invitationAction: [key: string, id: string]
  roleAction: [key: 'edit' | 'remove', id: string]
}>()
const auditColumns = computed(() => props.copy.audit ? [
  { key: 'action', header: props.copy.audit.action, field: 'action' },
  { key: 'actor', header: props.copy.audit.actor, field: 'actor' },
  { key: 'reason', header: props.copy.audit.reason, field: 'reason' },
  { key: 'date', header: props.copy.audit.date, field: 'date' },
] : [])
</script>
<template>
  <BsStack class="bs-access-page" gap="lg">
    <BsBox v-if="acceptance" as="section" padding="md"><BsHeading :level="1">{{ acceptance.title }}</BsHeading><BsText size="sm">{{ acceptance.help }}</BsText><BsAlert v-if="acceptance.error" tone="error">{{ acceptance.error }}</BsAlert><BsButton :pending="acceptance.pending" @click="emit('accept')">{{ acceptance.actionLabel }}</BsButton></BsBox>
    <BsPageHeader :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsButton v-if="canViewMatrix" @click="emit('matrix')">{{ copy.matrix }}</BsButton>
        <BsButton v-if="canCreateRole" variant="secondary" @click="emit('createRole')">{{ copy.newRole }}</BsButton>
        <BsButton v-if="canInvite" variant="primary" @click="emit('invite')">{{ copy.invite }}</BsButton>
      </template>
    </BsPageHeader>
    <BsSectionSkeleton v-if="loading" variant="table" :rows="6" />
    <BsAlert v-else-if="error" tone="error">{{ error }} <BsButton @click="emit('retry')">{{ copy.retry }}</BsButton></BsAlert>
    <BsEmptyState v-else-if="available === false" :title="copy.noTeam" />
    <template v-else>
      <BsAlert v-if="actionError" tone="error">{{ actionError }}</BsAlert>
      <BsAccessTabs :model-value="activeTab" :tabs="tabs" :label="copy.title" @update:model-value="emit('update:activeTab', $event)" />
      <template v-if="activeTab === 'members'">
        <section class="bs-access-page__members">
          <BsInline class="bs-access-page__filters" gap="md" justify="end" :wrap="true">
            <BsText v-if="copy.memberCount" size="sm" tone="muted">{{ copy.memberCount }}</BsText>
            <BsField v-if="copy.search" v-slot="field" :label="copy.search"><BsInput :id="field.id" type="search" :model-value="search" :placeholder="copy.search" @update:model-value="emit('update:search', String($event ?? ''))" /></BsField>
            <BsField v-if="statusOptions" v-slot="field" :label="statusLabel ?? ''"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="statusFilter" :options="statusOptions" :label="statusLabel" option-label="label" option-value="value" @update:model-value="emit('update:statusFilter', String($event ?? ''))" /></BsField>
          </BsInline>
          <BsAccessMemberTable :members="members" :label="copy.members" :empty-label="copy.noMembers" :labels="copy.memberColumns" :pending="pending" @action="(key, id) => emit('memberAction', key, id)" />
        </section>
        <BsStack v-if="audit && copy.audit" class="bs-access-page__audit">
          <BsHeading :level="2">{{ copy.audit.title }}</BsHeading>
          <BsDataTable :value="audit" :columns="auditColumns" row-key="id" :label="copy.audit.title"><template #empty><BsEmptyState :title="copy.audit.empty" /></template></BsDataTable>
        </BsStack>
      </template>
      <template v-else-if="activeTab === 'roles'">
        <BsHeading v-if="copy.roleSummary" :level="2" size="h3">{{ copy.roleSummary }}</BsHeading>
        <BsText v-if="copy.roleSummaryHint" size="sm" tone="muted">{{ copy.roleSummaryHint }}</BsText>
        <BsGrid :columns="4" gap="md">
          <BsCard v-for="role in roles" :key="role.id" padding="md">
            <BsInline gap="xs" justify="between" :wrap="true"><BsIcon name="team" /><BsButton v-for="action in role.actions" :key="action.key" size="sm" :disabled="pending || action.disabled" @click="emit('roleAction', action.key, role.id)">{{ action.label }}</BsButton></BsInline>
            <BsHeading :level="3" size="body">{{ role.label }}</BsHeading>
            <BsText v-if="role.description" size="sm" tone="muted">{{ role.description }}</BsText>
            <BsText size="xs" tone="muted">{{ role.permissions }}</BsText>
          </BsCard>
        </BsGrid>
      </template>
      <template v-else-if="activeTab === 'invitations'">
        <BsText v-if="copy.invitationCount" size="sm" tone="muted">{{ copy.invitationCount }}</BsText>
        <BsAccessInvitationTable :invitations="invitations" :label="copy.invitations" :empty-label="copy.noInvitations" :labels="copy.invitationColumns" :pending="pending" @action="(key, id) => emit('invitationAction', key, id)" />
      </template>
    </template>
    <BsPagination v-if="pagination && available !== false && !loading && !error" :page="pagination.page" :page-size="pagination.size" :total="pagination.total" :label="pagination.label" :previous-label="pagination.previous" :next-label="pagination.next" @update:page="emit('page', $event)" />
    <BsAccessIdentityEditor v-if="invitationEditor && invitationForm" v-model="invitationForm" :state="invitationEditor.state" :copy="invitationEditor.copy" :roles="invitationEditor.roles" :locations="invitationEditor.locations" :link="invitationEditor.link" :usage="invitationEditor.usage" :grant-options="invitationEditor.grantOptions" @close="emit('closeInvitation')" @submit="emit('submitInvitation')" />
    <BsAccessIdentityEditor v-if="memberEditor && memberForm" v-model="memberForm" :state="memberEditor.state" :copy="memberEditor.copy" :roles="memberEditor.roles" :locations="memberEditor.locations" :role-disabled="memberEditor.roleDisabled" :grant-options="memberEditor.grantOptions" email-readonly @close="emit('closeMember')" @submit="emit('submitMember')" />
    <BsAccessRoleEditor v-if="roleEditor && roleForm" v-model="roleForm" :state="roleEditor.state" :names="roleEditor.names" :permission-label="roleEditor.permissionLabel" :permissions="roleEditor.permissions" :archive-label="roleEditor.archiveLabel" :usage="roleEditor.usage" @close="emit('closeRole')" @submit="emit('submitRole')" @archive="emit('archiveRole')" />
    <BsRecordActionDialog v-if="confirmationEditor?.state.visible" :visible="true" :title="confirmationEditor.state.title" :dirty="confirmationEditor.state.dirty" :pending="confirmationEditor.state.pending" :error="confirmationEditor.state.error" :submit-label="confirmationEditor.state.submitLabel" :cancel-label="confirmationEditor.state.cancelLabel" :submit-disabled="confirmationEditor.state.submitDisabled" @update:visible="value => { if (!value) emit('closeConfirmation') }" @submit="emit('confirm')"><BsText>{{ confirmationEditor.description }}</BsText></BsRecordActionDialog>
    <BsDialog v-if="matrix?.visible" :visible="true" :title="matrix.title" :aria-label="matrix.title" size="lg" :pending="pending" @update:visible="value => { if (!value) emit('closeMatrix') }"><BsText size="sm" tone="muted">{{ matrix.hint }}</BsText><BsPermissionMatrix :items="matrix.items" :roles="matrix.roles" :label="matrix.permissionLabel" :grants="matrix.grants" /></BsDialog>
    <BsRecordActionDialog v-if="transferEditor?.state.visible" :visible="true" :title="transferEditor.state.title" :dirty="transferEditor.state.dirty" :pending="transferEditor.state.pending" :error="transferEditor.state.error" :submit-label="transferEditor.state.submitLabel" :cancel-label="transferEditor.state.cancelLabel" @update:visible="value => { if (!value) emit('closeTransfer') }" @submit="emit('submitTransfer')"><BsText size="sm">{{ transferEditor.help }}</BsText><BsField v-slot="field" :label="transferEditor.reasonLabel"><BsTextarea :id="field.id" v-model="transferReason" :aria-describedby="field.describedby" required :minlength="2" :maxlength="1000" :rows="3" /></BsField></BsRecordActionDialog>
  </BsStack>
</template>

<style scoped>
.bs-access-page :deep(.ls-tabs) {
  display: flex; flex-wrap: wrap; gap: var(--bs-space-3); border: 0;
}
.bs-access-page :deep(.ls-action-tab) {
  flex: 0 1 12.5rem; justify-content: center;
  min-height: var(--bs-tap-target-min);
  border: 1px solid var(--bs-primary); border-radius: var(--bs-radius-input);
  background: var(--bs-surface); color: var(--bs-text);
}
.bs-access-page :deep(.ls-action-tab[aria-selected='true']) {
  background: var(--bs-primary); color: var(--bs-text-on-primary);
}
.bs-access-page__members, .bs-access-page__audit {
  min-width: 0; padding: var(--bs-space-5);
  border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card);
  background: var(--bs-surface);
}
.bs-access-page__members :deep(.ls-table th),
.bs-access-page__audit :deep(.ls-table th) {
  background: var(--bs-surface); text-transform: none; letter-spacing: normal;
  font-weight: var(--bs-weight-regular);
}
.bs-access-page__members :deep(.ls-table td) { padding-block: var(--bs-space-5); }
.bs-access-page__filters { margin-block-end: var(--bs-space-5); }
.bs-access-page__filters :deep(.ls-field) { width: min(100%, 18.5rem); }
@media (max-width: 639px) {
  .bs-access-page :deep(.ls-tabs) { flex-wrap: nowrap; overflow-x: auto; max-inline-size: 100%; }
  .bs-access-page :deep(.ls-action-tab) { flex: 0 0 auto; }
  .bs-access-page__members, .bs-access-page__audit { padding: var(--bs-space-3); }
}
</style>
