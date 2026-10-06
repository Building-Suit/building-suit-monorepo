<script setup lang="ts">
const { t } = useI18n()
const ui = useUiCopy()
const labels = computed(() => ({ open: ui('open'), close: ui('close'), navigation: ui('navigation'), dashboard: t('welcome') }))
</script>
<template>
  <BsAppShell home-path="/" :product-name="t('product.name')" :groups="[]" :labels="labels">
    <template #logo>
      <BsText as="span">
        {{ t('product.name') }}
      </BsText>
    </template>
    <template #header>
      <BsSettingsMenu />
    </template>
    <BsSlot :render="$slots.default" />
  </BsAppShell>
</template>
