<script setup lang="ts">
withDefaults(defineProps<{ kind?: 'wordmark' | 'mark'; tone?: 'auto' | 'light' | 'dark' }>(), { kind: 'wordmark', tone: 'auto' })
</script>
<template><BsProductLogo name="Ledger Suit" asset-prefix="/brand/ledger-suit" :kind="kind" :tone="tone" /></template>
