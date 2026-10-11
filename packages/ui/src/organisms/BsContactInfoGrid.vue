<script setup lang="ts">
import type { ContactInfoItem } from '@building-suit/contracts'
defineProps<{ items: ContactInfoItem[] }>()
</script>
<template><div class="bs-contact-info"><div v-for="item in items" :key="item.key" class="bs-contact-info__item"><p class="bs-contact-info__label">{{ item.label }}</p><a v-if="item.href" :href="item.href" class="bs-contact-info__value bs-contact-info__link" :dir="item.direction">{{ item.value }}</a><p v-else class="bs-contact-info__value" :dir="item.direction">{{ item.value }}</p></div></div></template>
<style>
.bs-contact-info { display: grid; gap: 1px; background: var(--bs-border); }.bs-contact-info__item { padding: var(--bs-space-6); background: var(--bs-surface); }.bs-contact-info__label { color: var(--bs-text-muted); font-size: var(--bs-type-caption-size); font-weight: var(--bs-weight-bold); letter-spacing: .14em; text-transform: uppercase; }.bs-contact-info__value { display: block; margin-top: var(--bs-space-3); font-weight: var(--bs-weight-bold); }.bs-contact-info__link { color: var(--bs-link); overflow-wrap: anywhere; }@media (min-width: 640px) { .bs-contact-info__item { padding: var(--bs-space-8); } }@media (min-width: 768px) { .bs-contact-info { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
