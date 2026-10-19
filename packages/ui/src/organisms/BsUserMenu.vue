<script setup lang="ts">
import { useMenuNavigation } from '@building-suit/ux'
import type { NavigationLink } from '@building-suit/contracts'
import type { BsShellAccountDetail } from '../types/workspaceShellPresentation'

withDefaults(defineProps<{
  showSettings?: boolean
  compact?: boolean
  placement?: 'below' | 'above'
  name?: string
  email?: string
  avatarUrl?: string
  details?: BsShellAccountDetail[]
  actions?: NavigationLink[]
  accountLabel: string
  signOutLabel: string
  signOutPending?: boolean
  error?: string
}>(), {
  showSettings: true,
  compact: true,
  placement: 'below',
  name: '',
  email: '',
  avatarUrl: '',
  details: () => [],
  actions: () => [],
  signOutPending: false,
  error: '',
})

const emit = defineEmits<{ signOut: [] }>()
const route = useRoute()
const { open, root, panel, close, toggle, onKeydown } = useMenuNavigation(() => route.fullPath, '[data-user-menu-trigger]')
</script>

<template>
  <div ref="root" class="relative">
    <BsButton
      data-user-menu-trigger
      :variant="compact ? 'icon' : 'text'"
      :class="compact ? '' : 'w-full justify-start px-2 text-start'"
      :aria-label="accountLabel"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="toggle"
    >
      <BsUserIdentity :name="name" :email="email" :avatar-url="avatarUrl" :compact="compact" />
    </BsButton>

    <div
      v-if="open"
      ref="panel"
      :class="placement === 'above' ? 'bottom-full mb-2' : 'mt-1'"
      class="ls-card absolute end-0 z-40 max-h-[calc(100dvh-5rem)] w-[min(18rem,calc(100vw-2rem))] space-y-2 overflow-y-auto p-2 shadow-overlay"
      role="menu"
      :aria-label="accountLabel"
      @keydown="onKeydown"
    >
      <BsUserIdentity v-if="name || email" :name="name" :email="email" :avatar-url="avatarUrl" class="px-2 py-1" />
      <hr v-if="name || email" class="border-[var(--bs-border)]">

      <dl v-if="details.length" class="bs-user-menu__details">
        <div v-for="detail in details" :key="detail.label">
          <dt>{{ detail.label }}</dt>
          <dd v-for="(value, index) in detail.values" :key="index">{{ value }}</dd>
        </div>
      </dl>
      <hr v-if="details.length" class="border-[var(--bs-border)]">

      <NuxtLink
        v-for="action in actions"
        :key="action.to"
        :to="action.to"
        class="ls-nav-link min-h-11"
        role="menuitem"
        @click="close()"
      >
        <BsIcon v-if="action.icon" :name="action.icon" />
        <span>{{ action.label }}</span>
      </NuxtLink>

      <hr v-if="actions.length" class="border-[var(--bs-border)]">
      <BsSettingsMenu v-if="showSettings" embedded />
      <hr v-if="showSettings" class="border-[var(--bs-border)]">
      <p v-if="error" class="ls-error px-2 text-sm" role="alert">{{ error }}</p>
      <BsButton
        variant="danger"
        class="w-full"
        role="menuitem"
        :pending="signOutPending"
        @click="emit('signOut')"
      >
        {{ signOutLabel }}
      </BsButton>
    </div>
  </div>
</template>

<style scoped>
.bs-user-menu__details { display: grid; gap: 12px; padding: 4px 8px; }
.bs-user-menu__details dt { margin-block-end: 4px; color: var(--bs-text-muted); font-size: .75rem; }
.bs-user-menu__details dd { margin: 0; overflow-wrap: anywhere; font-size: .875rem; }
.bs-user-menu__details dd + dd { margin-block-start: 4px; }
</style>
