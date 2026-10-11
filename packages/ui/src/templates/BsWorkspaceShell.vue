<script setup lang="ts">
import type { NavigationGroup, NavigationLink, ScopeOption } from '@building-suit/contracts'
withDefaults(defineProps<{
  productName: string
  homePath?: string
  groups: NavigationGroup[]
  mobileLinks?: NavigationLink[]
  labels: { close: string; open: string; navigation: string; dashboard: string }
  context?: string
  account?: { name?: string; email?: string; label: string; signOut: string; pending?: boolean; error?: string }
  contextScope?: { key: string; value: string | null; label: string; options: ScopeOption[] }
  headerScopes?: { key: string; value: string | null; label: string; options: ScopeOption[]; visibility?: 'always' | 'mobile' | 'desktop' }[]
  state?: { loading: boolean; error: boolean; title: string; description?: string; retry: string }
  floatingActions?: boolean
  feedback?: boolean
  logo: { kind: 'text' | 'initials' | 'product'; initials?: string; assetPrefix?: string }
}>(), { context: undefined, account: undefined, contextScope: undefined, headerScopes: () => [], state: undefined, floatingActions: false, feedback: false, homePath: '/', mobileLinks: () => [] })
const emit = defineEmits<{ signOut: []; scope: [key: string, value: string | null]; retry: [] }>()
</script>
<template>
  <BsAppShell :home-path="homePath" :product-name="productName" :groups="groups" :mobile-links="mobileLinks" :labels="labels" :floating-actions="floatingActions">
    <template #logo>
      <BsProductLogo v-if="logo.kind === 'product'" :name="productName" :asset-prefix="logo.assetPrefix" />
      <BsInline v-else-if="logo.kind === 'initials'"><BsText as="span" size="sm">{{ logo.initials }}</BsText><BsText as="span">{{ productName }}</BsText></BsInline>
      <BsText v-else as="span">{{ productName }}</BsText>
    </template>
    <template #context><BsScopeSwitcher v-if="contextScope" :model-value="contextScope.value" :label="contextScope.label" :options="contextScope.options" visibility="mobile" @update:model-value="emit('scope', contextScope.key, $event)"/><BsText v-if="context" as="p" size="xs" tone="muted" emphasis="semibold">{{ context }}</BsText></template>
    <template #header><BsScopeSwitcher v-for="scope in headerScopes" :key="scope.key" :model-value="scope.value" :label="scope.label" :options="scope.options" compact :visibility="scope.visibility" @update:model-value="emit('scope', scope.key, $event)"/><BsUserMenu v-if="account" :name="account.name" :email="account.email" :sign-out-pending="account.pending" :error="account.error" :account-label="account.label" :sign-out-label="account.signOut" @sign-out="emit('signOut')" /><BsSettingsMenu v-else /></template>
    <BsStateSurface v-if="state?.error" state="error" :title="state.title" :description="state.description" :action-label="state.retry" @action="emit('retry')"/><BsSectionSkeleton v-else-if="state?.loading" variant="cards"/><BsStack v-else gap="sm"><slot /></BsStack>
    <template #overlays><BsToastHost v-if="feedback" /></template>
  </BsAppShell>
</template>
