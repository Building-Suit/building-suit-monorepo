<script setup lang="ts">
import type { PlanResourceKey, PlanUsageResource } from '~/types/plans'

const props = defineProps<{ usage: PlanUsageResource }>()
const { locale } = useI18n()
const isArabic = computed(() => locale.value === 'ar')
const labels = computed<Record<PlanResourceKey, string>>(() => isArabic.value ? {
  active_locations: 'الفروع النشطة', active_members: 'أعضاء الفريق',
  active_products: 'المنتجات النشطة', active_services: 'الخدمات النشطة',
  active_customers: 'العملاء النشطون', active_suppliers: 'الموردون النشطون',
} : {
  active_locations: 'Active locations', active_members: 'Team members',
  active_products: 'Active products', active_services: 'Active services',
  active_customers: 'Active customers', active_suppliers: 'Active suppliers',
})
const ratio = computed(() => props.usage.limit == null || props.usage.limit <= 0
  ? 0 : Math.min(100, Math.round((props.usage.used / props.usage.limit) * 100)))
const state = computed(() => props.usage.overLimit ? 'over' : props.usage.atLimit ? 'full' : ratio.value >= 80 ? 'near' : 'available')
const stateLabel = computed(() => {
  if (isArabic.value) return { over: 'أعلى من الحد', full: 'اكتمل الحد', near: 'قريب من الحد', available: 'متاح' }[state.value]
  return { over: 'Over limit', full: 'Limit reached', near: 'Near limit', available: 'Available' }[state.value]
})
const valueLabel = computed(() => props.usage.unlimited
  ? `${new Intl.NumberFormat(locale.value).format(props.usage.used)} · ${isArabic.value ? 'غير محدود' : 'Unlimited'}`
  : `${new Intl.NumberFormat(locale.value).format(props.usage.used)} / ${new Intl.NumberFormat(locale.value).format(props.usage.limit ?? 0)}`)
</script>

<template>
  <BsCard as="article" variant="flat" padding="sm" :class="state === 'available' ? '' : 'border-[var(--bs-status-warning)]/40 bg-[var(--bs-status-warning-bg)]'" :data-usage-state="state">
    <div class="flex items-start justify-between gap-3">
      <div><h3 class="text-sm font-bold">{{ labels[usage.resource] }}</h3><p class="mt-1 font-extrabold tabular-nums">{{ valueLabel }}</p></div>
      <BsStatusBadge v-if="!usage.unlimited" :status="state" :label="stateLabel" :tone="state === 'available' ? 'neutral' : 'warning'" />
    </div>
    <div v-if="!usage.unlimited" class="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" :aria-label="labels[usage.resource]" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="ratio">
      <span class="block h-full rounded-full transition-[width]" :class="state === 'available' ? 'bg-[var(--bs-link)]' : 'bg-[var(--bs-status-warning)]'" :style="{ width: `${ratio}%` }" />
    </div>
  </BsCard>
</template>
