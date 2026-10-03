<script setup lang="ts">
import type { NavigationLink } from '@building-suit/contracts'

withDefaults(defineProps<{
  name?: string
  email?: string
  avatarUrl?: string
  actions?: NavigationLink[]
  accountLabel: string
  signOutLabel: string
  signOutPending?: boolean
  error?: string
}>(), {
  name: '',
  email: '',
  avatarUrl: '',
  actions: () => [],
  signOutPending: false,
  error: '',
})

const emit = defineEmits<{ signOut: [] }>()
const route = useRoute()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)

function triggerElement() {
  return root.value?.querySelector<HTMLButtonElement>('[data-user-menu-trigger]') ?? null
}

function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus) nextTick(() => triggerElement()?.focus())
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  panel.value?.querySelector<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')?.focus()
}

function menuItems() {
  if (!panel.value) return []
  return [...panel.value.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')]
    .filter(item => !item.hasAttribute('disabled'))
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close(true)
    return
  }
  if (event.key === 'Tab') {
    close()
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const items = menuItems()
  if (!items.length) return
  event.preventDefault()
  const current = items.indexOf(document.activeElement as HTMLElement)
  const target = event.key === 'Home'
    ? items[0]
    : event.key === 'End'
      ? items.at(-1)
      : event.key === 'ArrowDown'
        ? items[(current + 1 + items.length) % items.length]
        : items[(current - 1 + items.length) % items.length]
  target?.focus()
}

useClickOutside(root, () => close())
watch(() => route.fullPath, () => close())
</script>

<template>
  <div ref="root" class="relative">
    <BsButton
      data-user-menu-trigger
      variant="icon"
      :aria-label="accountLabel"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="toggle"
    >
      <BsUserIdentity :name="name" :email="email" :avatar-url="avatarUrl" compact />
    </BsButton>

    <div
      v-if="open"
      ref="panel"
      class="ls-card absolute end-0 z-40 mt-1 max-h-[calc(100dvh-5rem)] w-[min(18rem,calc(100vw-2rem))] space-y-2 overflow-y-auto p-2 shadow-overlay"
      role="menu"
      :aria-label="accountLabel"
      @keydown="onKeydown"
    >
      <BsUserIdentity v-if="name || email" :name="name" :email="email" :avatar-url="avatarUrl" class="px-2 py-1" />
      <hr v-if="name || email" class="border-[var(--bs-border)]">

      <NuxtLink
        v-for="action in actions"
        :key="action.to"
        :to="action.to"
        class="ls-nav-link"
        role="menuitem"
        @click="close()"
      >
        <AppIcon v-if="action.icon" :name="action.icon" />
        <span>{{ action.label }}</span>
      </NuxtLink>

      <hr v-if="actions.length" class="border-[var(--bs-border)]">
      <SettingsMenu embedded />
      <hr class="border-[var(--bs-border)]">
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
