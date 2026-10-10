<script setup lang="ts">
import type { MarketingPricingNotice } from '@building-suit/contracts'
defineProps<{ notice: MarketingPricingNotice; tone?: 'info' | 'warning' | 'success' | 'error' }>()
</script>
<template><aside class="bs-plan-status" :data-tone="tone || 'warning'" role="status"><strong>{{ notice.title }}</strong><p v-if="notice.body">{{ notice.body }}</p><ul v-if="notice.items?.length"><li v-for="item in notice.items" :key="item">{{ item }}</li></ul><p v-if="notice.footer" class="bs-plan-status__footer">{{ notice.footer }}</p></aside></template>
<style>
.bs-plan-status { margin-top: var(--bs-space-5); padding: var(--bs-space-3); border: 1px solid color-mix(in oklab, var(--bs-status-warning) 30%, transparent); border-radius: var(--bs-radius-button); background: var(--bs-status-warning-bg); font-size: var(--bs-type-body-m-size); }
.bs-plan-status[data-tone='info'] { border-color: color-mix(in oklab, var(--bs-status-info) 30%, transparent); background: var(--bs-status-info-bg); }.bs-plan-status[data-tone='success'] { border-color: color-mix(in oklab, var(--bs-status-success) 30%, transparent); background: var(--bs-status-success-bg); }.bs-plan-status[data-tone='error'] { border-color: color-mix(in oklab, var(--bs-status-error) 30%, transparent); background: var(--bs-status-error-bg); }
.bs-plan-status p { margin-top: var(--bs-space-1); line-height: 1.25rem; }.bs-plan-status ul { margin-top: var(--bs-space-2); padding-inline-start: var(--bs-space-5); list-style: disc; }.bs-plan-status__footer { margin-top: var(--bs-space-3) !important; font-weight: var(--bs-weight-semibold); }
</style>
