<script setup lang="ts">
const { t } = useI18n()
const ui = useUiCopy()
const { suits, selection, label, to } = useAdminRegistry()
const labels = computed(() => ({ open: ui('open'), close: ui('close'), navigation: ui('navigation'), dashboard: t('welcome') }))
</script>
<template>
  <BsAppShell home-path="/" :product-name="t('product.name')" :groups="[]" :labels="labels">
    <template #logo><BsProductLogo :name="t('product.name')" /></template>
    <template #header><SettingsMenu /></template>
    <template #context>
      <div class="grid min-h-0 flex-1 grid-cols-[3rem_minmax(0,1fr)] gap-3 overflow-y-auto">
        <nav :aria-label="t('registry.suits')" class="flex flex-col gap-2 border-e border-[var(--bs-border)] pe-2">
          <NuxtLink v-for="suit in suits" :key="suit.key" :to="to(suit.key)" class="ls-nav-link min-h-11 justify-center p-1" :class="{ 'ls-nav-link-active': selection.suit?.key === suit.key }" :aria-current="selection.suit?.key === suit.key ? 'true' : undefined" :aria-label="label(suit.label)" :title="label(suit.label)">
            <img v-if="suit.asset" :src="suit.asset" alt="" class="size-7 object-contain">
            <span v-else aria-hidden="true">{{ label(suit.label).slice(0, 2) }}</span>
          </NuxtLink>
        </nav>
        <nav :aria-label="t('registry.context')" class="min-w-0 space-y-2">
          <h2 v-if="selection.suit" class="text-sm font-semibold break-words">{{ label(selection.suit.label) }}</h2>
          <NuxtLink v-for="item in selection.suit?.items || []" :key="item.key" :to="to(selection.suit!.key, item.key)" class="ls-nav-link break-words" :class="{ 'ls-nav-link-active': selection.item?.key === item.key }" :aria-current="selection.item?.key === item.key ? 'page' : undefined">{{ label(item.label) }}</NuxtLink>
          <p v-if="selection.suit && !selection.suit.items.length" class="text-sm text-fg-muted">{{ t('registry.empty') }}</p>
        </nav>
      </div>
    </template>
    <slot />
  </BsAppShell>
</template>
