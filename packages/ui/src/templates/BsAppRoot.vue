<script setup lang="ts">
withDefaults(defineProps<{
  layout?: 'default' | false
  layoutKey?: string
  pageKey?: string
  pageTransition?: false | { name?: string; mode?: 'in-out' | 'out-in' | 'default' }
  announcer?: boolean
  toastHost?: boolean
  confirmHost?: boolean
}>(), {
  layout: undefined, layoutKey: undefined, pageKey: undefined, pageTransition: false,
  announcer: false, toastHost: false, confirmHost: true,
})
</script>

<template>
  <div class="bs-app-root">
    <NuxtRouteAnnouncer v-if="announcer" />
    <NuxtLayout :key="layoutKey" :name="layout"><NuxtPage :key="pageKey" :transition="pageTransition" /></NuxtLayout>
    <BsToastHost v-if="toastHost" />
    <BsConfirmHost v-if="confirmHost" />
  </div>
</template>
