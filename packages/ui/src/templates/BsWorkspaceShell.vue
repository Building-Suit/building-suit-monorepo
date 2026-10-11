<script setup lang="ts">
import type { NavigationGroup, NavigationLink } from '@building-suit/contracts'
withDefaults(defineProps<{
  productName: string
  homePath?: string
  groups: NavigationGroup[]
  mobileLinks?: NavigationLink[]
  labels: { close: string; open: string; navigation: string; dashboard: string }
  context?: string
  account?: { email?: string; label: string; signOut: string }
  feedback?: boolean
  logo: { kind: 'text' | 'initials' | 'product'; initials?: string; assetPrefix?: string }
}>(), { context: undefined, account: undefined, feedback: false, homePath: '/', mobileLinks: () => [] })
const emit = defineEmits<{ signOut: [] }>()
</script>
<template>
  <BsAppShell :home-path="homePath" :product-name="productName" :groups="groups" :mobile-links="mobileLinks" :labels="labels">
    <template #logo>
      <BsProductLogo v-if="logo.kind === 'product'" :name="productName" :asset-prefix="logo.assetPrefix" />
      <BsInline v-else-if="logo.kind === 'initials'"><BsText as="span" size="sm">{{ logo.initials }}</BsText><BsText as="span">{{ productName }}</BsText></BsInline>
      <BsText v-else as="span">{{ productName }}</BsText>
    </template>
    <template #context><BsText v-if="context" as="p" size="xs" tone="muted" emphasis="semibold">{{ context }}</BsText></template>
    <template #header><BsUserMenu v-if="account" :email="account.email" :account-label="account.label" :sign-out-label="account.signOut" @sign-out="emit('signOut')" /><BsSettingsMenu v-else /></template>
    <BsStack gap="sm"><slot /></BsStack>
    <template #overlays><BsToastHost v-if="feedback" /><BsConfirmHost v-if="feedback" /></template>
  </BsAppShell>
</template>
