<script setup lang="ts">
import type { PlanResourceKey, PlanResourceLimits } from '~/types/plans'

const props = defineProps<{ limits: PlanResourceLimits | Record<string, number | null> }>()
const { locale } = useI18n()
const isArabic = computed(() => locale.value === 'ar')
const resources: PlanResourceKey[] = ['active_locations', 'active_members', 'active_products', 'active_services', 'active_customers', 'active_suppliers']
const labels = computed<Record<PlanResourceKey, string>>(() => isArabic.value ? {
  active_locations: 'فروع المتجر التي يمكنك تشغيلها', active_members: 'الأشخاص في فريقك',
  active_products: 'المنتجات التي يمكنك إبقاؤها نشطة', active_services: 'الخدمات التي يمكنك إبقاؤها نشطة',
  active_customers: 'العملاء الذين يمكنك إبقاؤهم نشطين', active_suppliers: 'الموردون الذين يمكنك إبقاؤهم نشطين',
} : {
  active_locations: 'Shop locations you can run', active_members: 'People on your team',
  active_products: 'Products you can keep active', active_services: 'Services you can keep active',
  active_customers: 'Customers you can keep active', active_suppliers: 'Suppliers you can keep active',
})

function value(resource: PlanResourceKey) {
  const limit = props.limits[resource]

  if (limit == null) {
    return isArabic.value ? 'غير محدود' : 'Unlimited'
  }

  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    numberingSystem: isArabic.value ? 'arab' : 'latn',
  }).format(limit)
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
