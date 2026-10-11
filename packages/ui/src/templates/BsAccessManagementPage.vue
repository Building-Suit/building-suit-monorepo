<script setup lang="ts">
import type { BsAccessMemberView, BsAccessMemberAction, BsAccessInvitationView, BsAccessRoleView, BsAccessAuditView, BsAccessPageCopy, BsAccessEditorState, BsAccessIdentityForm, BsAccessIdentityCopy, BsAccessRoleForm } from '../types/accessPresentation'
import type { BsUsageItem } from '@building-suit/contracts'
import type { BsPermissionItem, BsPermissionRole } from '@building-suit/ux'
const invitationForm = defineModel<BsAccessIdentityForm>('invitationForm')
const memberForm = defineModel<BsAccessIdentityForm>('memberForm')
const roleForm = defineModel<BsAccessRoleForm>('roleForm')
const transferReason = defineModel<string>('transferReason')
const props = defineProps<{
  invitationEditor?: { state: BsAccessEditorState; copy: BsAccessIdentityCopy; roles: { value: string; label: string; disabled?: boolean }[]; locations?: { id: string; name: string }[]; link?: string; usage?: BsUsageItem }
  memberEditor?: { state: BsAccessEditorState; copy: BsAccessIdentityCopy; roles: { value: string; label: string; description?: string; disabled?: boolean }[]; locations?: { id: string; name: string }[]; roleDisabled?: boolean }
  roleEditor?: { state: BsAccessEditorState; names?: { english: string; arabic: string; maxLength: number; minLength?: number }; permissionLabel: string; permissions: { key: string; label: string; disabled?: boolean }[]; archiveLabel?: string; usage?: BsUsageItem }
  matrix?: { visible: boolean; title: string; hint: string; permissionLabel: string; closeLabel: string; items: BsPermissionItem[]; roles: BsPermissionRole[]; granted: (role: string, permission: string) => boolean }
  transferEditor?: { state: BsAccessEditorState; help: string; reasonLabel: string }
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
}>()
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
  invite: []
  createRole: []
  matrix: []
  retry: []
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
  <BsStack gap="lg">
    <BsBox v-if="acceptance" as="section" padding="md"><BsHeading :level="1">{{ acceptance.title }}</BsHeading><BsText size="sm">{{ acceptance.help }}</BsText><BsAlert v-if="acceptance.error" tone="error">{{ acceptance.error }}</BsAlert><BsButton :pending="acceptance.pending" @click="emit('accept')">{{ acceptance.actionLabel }}</BsButton></BsBox>
    <BsPageHeader :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsButton v-if="canViewMatrix" @click="emit('matrix')">{{ copy.matrix }}</BsButton>
        <BsButton v-if="canCreateRole" variant="primary" @click="emit('createRole')">{{ copy.newRole }}</BsButton>
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
        <BsInline gap="md" justify="between" :wrap="true">
          <BsText v-if="copy.memberCount" size="sm" tone="muted">{{ copy.memberCount }}</BsText>
          <BsField v-if="copy.search" v-slot="field" :label="copy.search"><BsInput :id="field.id" type="search" :model-value="search" :placeholder="copy.search" @update:model-value="emit('update:search', String($event ?? ''))" /></BsField>
          <BsSelect v-if="statusOptions" :model-value="statusFilter" :options="statusOptions" :label="statusLabel" option-label="label" option-value="value" @update:model-value="emit('update:statusFilter', String($event ?? ''))" />
        </BsInline>
        <BsAccessMemberTable :members="members" :label="copy.members" :empty-label="copy.noMembers" :labels="copy.memberColumns" :pending="pending" @action="(key, id) => emit('memberAction', key, id)" />
        <BsStack v-if="audit && copy.audit">
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
    <BsAccessIdentityEditor v-if="invitationEditor && invitationForm" v-model="invitationForm" :state="invitationEditor.state" :copy="invitationEditor.copy" :roles="invitationEditor.roles" :locations="invitationEditor.locations" :link="invitationEditor.link" :usage="invitationEditor.usage" @close="emit('closeInvitation')" @submit="emit('submitInvitation')" />
    <BsAccessIdentityEditor v-if="memberEditor && memberForm" v-model="memberForm" :state="memberEditor.state" :copy="memberEditor.copy" :roles="memberEditor.roles" :locations="memberEditor.locations" :role-disabled="memberEditor.roleDisabled" email-readonly @close="emit('closeMember')" @submit="emit('submitMember')" />
    <BsAccessRoleEditor v-if="roleEditor && roleForm" v-model="roleForm" :state="roleEditor.state" :names="roleEditor.names" :permission-label="roleEditor.permissionLabel" :permissions="roleEditor.permissions" :archive-label="roleEditor.archiveLabel" :usage="roleEditor.usage" @close="emit('closeRole')" @submit="emit('submitRole')" @archive="emit('archiveRole')" />
    <BsDialog v-if="matrix?.visible" :visible="true" :title="matrix.title" :aria-label="matrix.title" size="lg" :pending="pending" @update:visible="value => { if (!value) emit('closeMatrix') }"><BsText size="sm" tone="muted">{{ matrix.hint }}</BsText><BsPermissionMatrix :items="matrix.items" :roles="matrix.roles" :label="matrix.permissionLabel" :granted="matrix.granted" /></BsDialog>
    <BsRecordActionDialog v-if="transferEditor?.state.visible" :visible="true" :title="transferEditor.state.title" :dirty="transferEditor.state.dirty" :pending="transferEditor.state.pending" :error="transferEditor.state.error" :submit-label="transferEditor.state.submitLabel" :cancel-label="transferEditor.state.cancelLabel" @update:visible="value => { if (!value) emit('closeTransfer') }" @submit="emit('submitTransfer')"><BsText size="sm">{{ transferEditor.help }}</BsText><BsField v-slot="field" :label="transferEditor.reasonLabel"><BsTextarea :id="field.id" v-model="transferReason" :aria-describedby="field.describedby" required :minlength="2" :maxlength="1000" :rows="3" /></BsField></BsRecordActionDialog>
  </BsStack>
</template>
