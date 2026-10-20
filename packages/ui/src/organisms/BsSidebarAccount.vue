<script setup lang="ts">
import type { NavigationLink } from '@building-suit/contracts'
import type { BsShellAccountDetail } from '../types/workspaceShellPresentation'
withDefaults(defineProps<{
  avatarUrl?: string; details?: BsShellAccountDetail[]; rail?: boolean; collapsed?: boolean; name?: string; email?: string; actions?: NavigationLink[]
  accountLabel: string; signOutLabel: string; signOutPending?: boolean; error?: string
  plan?: { name: string; status: string; detail: string; actionLabel: string; to: string } | null
}>(), { avatarUrl: '', details: () => [], rail: false, collapsed: false, name: '', email: '', actions: () => [], signOutPending: false, error: '', plan: null })
defineEmits<{ signOut: [] }>()
</script>
<template>
  <div class="bs-sidebar-account__frame space-y-3 border-t border-line pt-3">
    <BsPlanSummary v-if="plan && !rail" v-bind="plan" :collapsed="collapsed" />
    <div class="bs-sidebar-account" :class="{ 'bs-sidebar-account--collapsed': collapsed }">
      <BsUserMenu :name="name" :email="email" :avatar-url="avatarUrl" :details="details" :actions="rail ? [] : actions" :show-settings="!rail" :account-label="accountLabel" :sign-out-label="signOutLabel" :sign-out-pending="signOutPending" :error="error" placement="above" :compact="rail" @sign-out="$emit('signOut')" />
    </div>
  </div>
</template>
<style scoped>
.bs-sidebar-account :deep([role="menu"]) { inset-inline-start: 0; inset-inline-end: auto; }
@media (min-width: 1024px) {
  .bs-sidebar-account--collapsed :deep([data-user-menu-trigger] .bs-user-identity__text) { display: none; }
  .bs-sidebar-account--collapsed :deep([data-user-menu-trigger]) { padding-inline: 0; justify-content: center; }
}
</style>
