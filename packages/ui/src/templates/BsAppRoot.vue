<script setup lang="ts">
import type { PageMeta } from '#app'
const props = withDefaults(defineProps<{
  renderPage?: boolean
  layout?: 'default' | 'landing' | 'platform-admin' | false
  layoutKey?: string
  pageKey?: string
  pageTransition?: false | { name?: string; mode?: 'in-out' | 'out-in' | 'default' }
  announcer?: boolean
  toastHost?: boolean
  confirmHost?: boolean
}>(), {
  renderPage: true, layout: undefined, layoutKey: undefined, pageKey: undefined, pageTransition: false,
  announcer: false, toastHost: false, confirmHost: true,
})
// Each consuming app has its own generated layout-name union. The caller
// supplies a registered name; this shared boundary forwards that configuration.
function nativeLayoutName() { return props.layout as PageMeta['layout'] }
function scopedPageKey(route: { path: string }) { return `${route.path}:${props.pageKey}` }
</script>

<template>
  <div class="bs-app-root">
    <NuxtRouteAnnouncer v-if="announcer" />
    <NuxtLayout v-if="renderPage" :key="layoutKey" :name="nativeLayoutName()"><NuxtPage :page-key="pageKey === undefined ? undefined : scopedPageKey" :transition="pageTransition" /></NuxtLayout>
    <BsSectionSkeleton v-else :rows="3" />
    <BsToastHost v-if="toastHost" />
    <BsConfirmHost v-if="confirmHost" />
  </div>
</template>
