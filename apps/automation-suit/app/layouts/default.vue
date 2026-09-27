<script setup lang="ts">
const { t } = useI18n()

const groups = computed(() => [
  {
    key: 'operations',
    label: t('nav.operations'),
    links: [
      { to: '/', label: t('nav.dashboard') },
      { to: '/projects', label: 'Projects' },
      { to: '/tasks', label: 'Tasks' },
      { to: '/runs', label: 'Runs' },
      { to: '/errors', label: 'Errors' },
      { to: '/policies', label: 'Policies' },
      { to: '/n8n', label: 'n8n' },
    ],
  },
])

const labels = computed(() => ({
  open: t('nav.open'),
  close: t('nav.close'),
  navigation: t('nav.navigation'),
  dashboard: t('nav.dashboard'),
}))
</script>

<template>
  <BsAppShell home-path="/" :product-name="t('app.name')" :groups="groups" :labels="labels">
    <template #logo>
      <div class="flex items-center gap-3">
        <span class="grid h-9 w-9 place-items-center rounded-control border border-[var(--bs-border)] bg-surface-muted text-sm font-black">AS</span>
        <span class="text-base font-black">{{ t('app.name') }}</span>
      </div>
    </template>
    <template #header><SettingsMenu /></template>
    <div class="pb-16"><slot /></div>
  </BsAppShell>
</template>
