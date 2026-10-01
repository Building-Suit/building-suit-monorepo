<script setup lang="ts">
import type { PlanResourceKey, PlanResourceLimits } from '~/types/plans'

const props = defineProps<{ limits: PlanResourceLimits | Record<string, number | null> }>()
const { locale } = useI18n()
const isArabic = computed(() => locale.value === 'ar')
const resources: PlanResourceKey[] = ['active_locations', 'active_members', 'active_products', 'active_services', 'active_customers', 'active_suppliers']
const labels = computed<Record<PlanResourceKey, string>>(() => isArabic.value ? {
  active_locations: 'الفروع النشطة', active_members: 'أعضاء الفريق',
  active_products: 'المنتجات النشطة', active_services: 'الخدمات النشطة',
  active_customers: 'العملاء النشطون', active_suppliers: 'الموردون النشطون',
} : {
  active_locations: 'Active locations', active_members: 'Team members',
  active_products: 'Active products', active_services: 'Active services',
  active_customers: 'Active customers', active_suppliers: 'Active suppliers',
})

function value(resource: PlanResourceKey) {
  const limit = props.limits[resource]
  return limit == null ? (isArabic.value ? 'غير محدود' : 'Unlimited') : new Intl.NumberFormat(locale.value).format(limit)
}
</script>

<template>
  <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
    <div v-for="resource in resources" :key="resource" class="min-w-0 border-t border-border pt-3">
      <dt class="text-xs leading-5 text-muted-foreground">{{ labels[resource] }}</dt>
      <dd class="mt-1 font-extrabold tabular-nums">{{ value(resource) }}</dd>
    </div>
  </dl>
</template>
