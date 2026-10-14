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
  <BsWorkspaceShell home-path="/" :product-name="t('app.name')" :groups="groups" :labels="labels" :logo="{ kind: 'initials', initials: 'AS' }"><slot /></BsWorkspaceShell>
</template>
