<script setup lang="ts">
import type { MarketingPricingPlan } from '@building-suit/contracts'
import type { PlanResourceKey, ShopPlanInterval, ShopPlanOffer, ShopPlanVariant } from '~/types/plans'

const props = withDefaults(defineProps<{
  offers: ShopPlanOffer[]
  selectedCatalogTermsId?: string
  currentCatalogTermsId?: string
  action?: 'signup' | 'select'
  loading?: boolean
  error?: string | null
  intro?: string
  emptyLabel?: string
}>(), { selectedCatalogTermsId: '', currentCatalogTermsId: '', action: 'signup', loading: false, error: null, intro: undefined, emptyLabel: undefined })
const emit = defineEmits<{ select: [offer: ShopPlanOffer]; retry: [] }>()
const { locale } = useI18n()
const isArabic = computed(() => locale.value === 'ar')
const copy = computed(() => isArabic.value ? ar : en)
const interval = ref<ShopPlanInterval>('monthly')
const multiVariant = ref<Extract<ShopPlanVariant, 'multi_2' | 'multi_3'>>('multi_2')
const familyOrder = ['solo', 'team', 'multi'] as const
const resources: PlanResourceKey[] = ['active_locations', 'active_members', 'active_products', 'active_services', 'active_customers', 'active_suppliers']

const selectedOffer = computed(() => props.offers.find(offer => offer.catalogTermsId === props.selectedCatalogTermsId) ?? null)
const cards = computed(() => familyOrder.map((slug) => {
  const variant = slug === 'multi' ? multiVariant.value : 'standard'
  return props.offers.find(offer => offer.planSlug === slug && offer.planVariant === variant && offer.billingInterval === interval.value) ?? null
}).filter((offer): offer is ShopPlanOffer => offer !== null))
const annualDiscount = computed(() => {
  const discounts = props.offers.filter(offer => offer.billingInterval === 'annual').map(yearlyDiscount)
  const unique = [...new Set(discounts)]
  return unique.length === 1 ? unique[0]! : null
})

const pricingPlans = computed<MarketingPricingPlan[]>(() => cards.value.map(offer => ({
  id: offer.planSlug,
  name: familyName(offer),
  badge: isCurrent(offer) ? copy.value.current : undefined,
  badgeTone: isCurrent(offer) ? 'current' : undefined,
  selected: isSelected(offer),
  originalPrice: interval.value === 'annual' ? money(yearlyOriginal(offer), offer.currency) : undefined,
  discount: interval.value === 'annual' ? copy.value.discount(yearlyDiscount(offer)) : undefined,
  price: money(offer.effectivePriceAmount, offer.currency),
  priceNote: interval.value === 'annual'
    ? copy.value.yearlyEquivalent(money(offer.effectivePriceAmount / 12, offer.currency), money(offer.effectivePriceAmount, offer.currency))
    : copy.value.perMonth,
  priceDetail: offer.priceSource === 'override' || offer.effectivePriceAmount !== offer.listPriceAmount
    ? `${copy.value.negotiated} · ${copy.value.publicList}: ${money(offer.listPriceAmount, offer.currency)}`
    : undefined,
  features: resources.map(resource => ({ key: resource, included: true, text: `${copy.value.resourceLimits[resource]}: ${limit(offer, resource)}` })),
  variant: offer.planSlug === 'multi' ? {
    legend: copy.value.variants,
    value: multiVariant.value,
    options: [{ value: 'multi_2', label: copy.value.twoBranches }, { value: 'multi_3', label: copy.value.threeBranches }],
  } : undefined,
  notice: offer.blockers.length ? {
    title: copy.value.blocked,
    body: copy.value.blockers,
    items: offer.blockers.map(blocker => `${copy.value.resources[blocker.resource]}: ${blocker.used} ${copy.value.used} / ${blocker.limit} ${copy.value.limit} · ${blocker.excess} ${copy.value.over}`),
    footer: copy.value.preservation,
  } : undefined,
  action: props.action === 'signup'
    ? { label: copy.value.startTrial, to: '/auth/signup', variant: 'primary' }
    : { label: isSelected(offer) ? copy.value.selected : copy.value.choose, pressed: isSelected(offer), variant: isSelected(offer) ? 'default' : 'primary' },
})))

watch(() => props.selectedCatalogTermsId, (catalogTermsId) => {
  const selected = props.offers.find(offer => offer.catalogTermsId === catalogTermsId)
  if (!selected) return
  interval.value = selected.billingInterval
  if (selected.planVariant !== 'standard') multiVariant.value = selected.planVariant
}, { immediate: true })

watch([interval, multiVariant], () => {
  if (props.action !== 'select' || !selectedOffer.value) return
  const selectedFamily = selectedOffer.value.planSlug
  const matching = props.offers.find(offer => offer.planSlug === selectedFamily
    && offer.billingInterval === interval.value
    && offer.planVariant === (selectedFamily === 'multi' ? multiVariant.value : 'standard'))
  if (matching && matching.catalogTermsId !== selectedOffer.value.catalogTermsId) emit('select', matching)
})

function familyName(offer: ShopPlanOffer) {
  if (offer.planSlug === 'solo') return 'Solo'
  if (offer.planSlug === 'team') return 'Team'
  if (offer.planSlug === 'multi') return 'Multi'
  return offer.planName
}
function money(value: number, currency: string) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency, minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(value)
}
function monthlyOffer(offer: ShopPlanOffer) {
  return props.offers.find(candidate => candidate.planSlug === offer.planSlug && candidate.planVariant === offer.planVariant && candidate.billingInterval === 'monthly') ?? null
}
function yearlyOriginal(offer: ShopPlanOffer) { return (monthlyOffer(offer)?.listPriceAmount ?? 0) * 12 }
function yearlyDiscount(offer: ShopPlanOffer) {
  const original = yearlyOriginal(offer)
  return original ? Math.round((1 - offer.listPriceAmount / original) * 100) : 0
}
function isCurrent(offer: ShopPlanOffer) { return offer.catalogTermsId === props.currentCatalogTermsId }
function isSelected(offer: ShopPlanOffer) { return offer.catalogTermsId === props.selectedCatalogTermsId }
function limit(offer: ShopPlanOffer, resource: PlanResourceKey) {
  const value = offer.resourceLimits[resource]
  return value == null ? copy.value.unlimited : new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { numberingSystem: isArabic.value ? 'arab' : 'latn' }).format(value)
}
function choose(planId: string) {
  const offer = cards.value.find(candidate => candidate.planSlug === planId)
  if (offer && props.action === 'select') emit('select', offer)
}
function chooseVariant(_: string, value: string) { multiVariant.value = value as typeof multiVariant.value }

const en = {
  cycle: 'Billing cycle', monthly: 'Monthly', yearly: 'Yearly', annualSaving: (percent: number) => `Save ${percent}% with yearly billing`,
  variants: 'Multi branch allowance', twoBranches: '2 branches', threeBranches: '3 branches', discount: (percent: number) => `${percent}% off`, perMonth: 'per month',
  yearlyEquivalent: (monthly: string, yearly: string) => `${monthly}/month · billed ${yearly} per year`, negotiated: 'Founder / negotiated price', publicList: 'Public list price', current: 'Current',
  choose: 'Choose plan', selected: 'Selected', startTrial: 'Start 7-day free trial', blocked: 'Plan change blockers', blockers: 'Approval waits until you resolve each excess resource below.',
  preservation: 'All data stays saved. Excess active resources cannot be used for new activity until you reduce usage or upgrade the plan. Nothing is deleted or archived automatically.',
  used: 'used', limit: 'limit', over: 'over', unlimited: 'Unlimited', loading: 'Loading plans', empty: 'No plans are available.', retry: 'Retry', included: 'Included', notIncluded: 'Not included',
  resources: { active_locations: 'Shop locations', active_members: 'People on your team', active_products: 'Active products', active_services: 'Active services', active_customers: 'Active customers', active_suppliers: 'Active suppliers' },
  resourceLimits: { active_locations: 'Shop locations you can run', active_members: 'People on your team', active_products: 'Products you can keep active', active_services: 'Services you can keep active', active_customers: 'Customers you can keep active', active_suppliers: 'Suppliers you can keep active' },
}
const ar = {
  cycle: 'دورة الفوترة', monthly: 'شهري', yearly: 'سنوي', annualSaving: (percent: number) => `وفّر ${new Intl.NumberFormat('ar-EG').format(percent)}٪ مع الدفع السنوي`,
  variants: 'عدد الفروع في خطة مالتي', twoBranches: 'فرعان', threeBranches: '٣ فروع', discount: (percent: number) => `خصم ${percent}٪`, perMonth: 'شهريًا',
  yearlyEquivalent: (monthly: string, yearly: string) => `${monthly} شهريًا · تُدفع ${yearly} سنويًا`, negotiated: 'سعر مؤسس / تفاوضي', publicList: 'السعر المعلن للجمهور', current: 'الحالية',
  choose: 'اختيار الخطة', selected: 'تم الاختيار', startTrial: 'ابدأ تجربة مجانية ٧ أيام', blocked: 'عوائق تغيير الخطة', blockers: 'ينتظر الاعتماد حتى تعالج كل مورد زائد موضح أدناه.',
  preservation: 'تظل كل البيانات محفوظة. لا يمكن استخدام الموارد النشطة الزائدة في نشاط جديد حتى تخفّض الاستخدام أو ترقي الخطة. لن يُحذف أو يُؤرشف أي شيء تلقائيًا.',
  used: 'مستخدم', limit: 'الحد', over: 'زائد', unlimited: 'غير محدود', loading: 'جارٍ تحميل الخطط', empty: 'لا توجد خطط متاحة.', retry: 'إعادة المحاولة', included: 'مشمول', notIncluded: 'غير مشمول',
  resources: { active_locations: 'فروع المتجر', active_members: 'أفراد فريقك', active_products: 'المنتجات النشطة', active_services: 'الخدمات النشطة', active_customers: 'العملاء النشطون', active_suppliers: 'الموردون النشطون' },
  resourceLimits: { active_locations: 'فروع المتجر التي يمكنك تشغيلها', active_members: 'الأشخاص في فريقك', active_products: 'المنتجات التي يمكنك إبقاؤها نشطة', active_services: 'الخدمات التي يمكنك إبقاؤها نشطة', active_customers: 'العملاء الذين يمكنك إبقاؤهم نشطين', active_suppliers: 'الموردون الذين يمكنك إبقاؤهم نشطين' },
}
</script>

<template>
  <BsMarketingPricing
    :interval="interval"
    :plans="pricingPlans"
    :interval-options="[{ value: 'monthly', label: copy.monthly }, { value: 'annual', label: copy.yearly }]"
    :copy="{ cycleLabel: copy.cycle, loading: copy.loading, empty: emptyLabel ?? copy.empty, retry: copy.retry, included: copy.included, notIncluded: copy.notIncluded }"
    :annual-saving="annualDiscount === null ? null : copy.annualSaving(annualDiscount)"
    :columns="3"
    :loading="loading"
    :error="error"
    :intro="intro"
    test-id="shop-plan-cards"
    @update:interval="value => { if (value === 'monthly' || value === 'annual') interval = value }"
    @update:variant="chooseVariant"
    @action="choose"
    @retry="emit('retry')"
  />
</template>
