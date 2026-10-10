<script setup lang="ts">
const { t } = useI18n()
const ui = useUiCopy()
const router = useRouter()
const { suits, selection, state, label, to } = useAdminRegistry()
const rail = computed(() => suits.value.map(suit => ({ id: suit.key, label: label(suit.label), logo: suit.asset || undefined })))
const groups = computed(() => selection.value.suit ? [{
  id: selection.value.suit.key,
  label: label(selection.value.suit.label),
  items: selection.value.suit.items.map(item => ({ id: item.key, label: label(item.label), to: router.resolve(to(selection.value.suit!.key, item.key)).href })),
}] : [])
const labels = computed(() => ({ suits: t('registry.suits'), navigation: t('registry.context'), open: ui('open'), close: ui('close'), loading: t('registry.loading'), emptySuits: t('registry.empty'), emptyNavigation: t('registry.empty') }))
</script>

<template>
  <BsAdministrationShell :suits="rail" :groups="groups" :selected-suit="selection.suit?.key" :selected-context="selection.item?.key" :context-title="selection.suit ? label(selection.suit.label) : t('registry.context')" :labels="labels" :loading="state === 'loading'" @select-suit="item => navigateTo(to(item.id))">
    <template #header>
      <BsInline justify="between">
        <BsProductLogo :name="t('product.name')" />
        <BsSettingsMenu />
      </BsInline>
    </template>
    <BsSlot :render="$slots.default" />
  </BsAdministrationShell>
</template>
