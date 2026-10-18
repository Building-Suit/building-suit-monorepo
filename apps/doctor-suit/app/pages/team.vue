<script setup lang="ts">
definePageMeta({ layout: 'practice', middleware: 'doctor-auth' })
const { context,team,copy,scopeKey,query,activeTab,invitationForm,memberForm,hydrated,available,canInvite,members,invitations,invitationEditor,memberEditor,confirmationEditor,pagination,reload,search,page,tab,invite,memberAction,invitationAction,submitInvitation,submitMember,submitConfirmation,closeInvitation,closeMember,closeConfirmation,error } = useDoctorTeamManagement()
await context.refresh()
await reload()
</script>
<template>
  <BsAccessManagementPage :key="scopeKey || 'no-context'" v-model:invitation-form="invitationForm" v-model:member-form="memberForm" :copy="copy" :tabs="[{ key: 'members', label: copy.members, count: team.state.directory?.memberTotal || 0 }, { key: 'invitations', label: copy.invitations, count: team.state.directory?.invitationTotal || 0 }]" :active-tab="activeTab" :members="members" :roles="[]" :invitations="invitations" :loading="team.state.loading || !hydrated" :error="scopeKey ? error : null" :available="available" :pending="team.state.pending || !hydrated" :can-invite="hydrated && canInvite" :search="query.search" :invitation-editor="invitationEditor" :member-editor="memberEditor" :confirmation-editor="confirmationEditor" :pagination="pagination" @update:active-tab="tab" @update:search="search" @page="page" @invite="invite" @member-action="memberAction" @invitation-action="invitationAction" @submit-invitation="submitInvitation" @submit-member="submitMember" @close-invitation="closeInvitation" @close-member="closeMember" @close-confirmation="closeConfirmation" @confirm="submitConfirmation" @retry="reload" />
</template>
