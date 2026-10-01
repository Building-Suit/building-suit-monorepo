<script setup lang="ts">
import type { PlanResourceKey, ShopPlanInterval, ShopPlanOffer, ShopPlanVariant } from '~/types/plans'

const props = withDefaults(defineProps<{
  offers: ShopPlanOffer[]
  selectedCatalogTermsId?: string
  currentCatalogTermsId?: string
  action?: 'signup' | 'select'
}>(), {
  selectedCatalogTermsId: '',
  currentCatalogTermsId: '',
  action: 'signup',
})
const emit = defineEmits<{ select: [offer: ShopPlanOffer] }>()
const { locale } = useI18n()
const isArabic = computed(() => locale.value === 'ar')
const copy = computed(() => isArabic.value ? ar : en)
const interval = ref<ShopPlanInterval>('monthly')
const multiVariant = ref<Extract<ShopPlanVariant, 'multi_2' | 'multi_3'>>('multi_2')
const familyOrder = ['solo', 'team', 'multi'] as const

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
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    style: 'currency', currency, minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2,
  }).format(value)
}

function monthlyOffer(offer: ShopPlanOffer) {
  return props.offers.find(candidate => candidate.planSlug === offer.planSlug
    && candidate.planVariant === offer.planVariant && candidate.billingInterval === 'monthly') ?? null
}

function yearlyOriginal(offer: ShopPlanOffer) {
  return (monthlyOffer(offer)?.listPriceAmount ?? 0) * 12
}

function yearlyDiscount(offer: ShopPlanOffer) {
  const original = yearlyOriginal(offer)
  return original ? Math.round((1 - offer.listPriceAmount / original) * 100) : 0
}

function resourceLabel(resource: PlanResourceKey) {
  return copy.value.resources[resource]
}

function isCurrent(offer: ShopPlanOffer) {
  return offer.catalogTermsId === props.currentCatalogTermsId
}

function isSelected(offer: ShopPlanOffer) {
  return offer.catalogTermsId === props.selectedCatalogTermsId
}

const en = {
  cycle: 'Billing cycle', monthly: 'Monthly', yearly: 'Yearly', annualSaving: (percent: number) => `Save ${percent}% with yearly billing`,
  variants: 'Multi branch allowance', twoBranches: '2 branches', threeBranches: '3 branches',
  original: 'Original yearly price', discount: (percent: number) => `${percent}% off`, perMonth: 'per month',
  yearlyEquivalent: (monthly: string, yearly: string) => `${monthly}/month · billed ${yearly} per year`,
  negotiated: 'Founder / negotiated price', publicList: 'Public list price', current: 'Current',
  choose: 'Choose plan', selected: 'Selected', startTrial: 'Start 7-day free trial',
  blocked: 'Plan change blockers', blockers: 'Approval waits until you resolve each excess resource below.',
  preservation: 'All data stays saved. Excess active resources cannot be used for new activity until you reduce usage or upgrade the plan. Nothing is deleted or archived automatically.',
  used: 'used', limit: 'limit', over: 'over',
  resources: { active_locations: 'Shop locations', active_members: 'People on your team', active_products: 'Active products', active_services: 'Active services', active_customers: 'Active customers', active_suppliers: 'Active suppliers' },
}

const ar = {
  cycle: 'دورة الفوترة', monthly: 'شهري', yearly: 'سنوي', annualSaving: (percent: number) => `وفّر ${new Intl.NumberFormat('ar-EG').format(percent)}٪ مع الدفع السنوي`,
  variants: 'عدد الفروع في خطة مالتي', twoBranches: 'فرعان', threeBranches: '٣ فروع',
  original: 'السعر السنوي الأصلي', discount: (percent: number) => `خصم ${percent}٪`, perMonth: 'شهريًا',
  yearlyEquivalent: (monthly: string, yearly: string) => `${monthly} شهريًا · تُدفع ${yearly} سنويًا`,
  negotiated: 'سعر مؤسس / تفاوضي', publicList: 'السعر المعلن للجمهور', current: 'الحالية',
  choose: 'اختيار الخطة', selected: 'تم الاختيار', startTrial: 'ابدأ تجربة مجانية ٧ أيام',
  blocked: 'عوائق تغيير الخطة', blockers: 'ينتظر الاعتماد حتى تعالج كل مورد زائد موضح أدناه.',
  preservation: 'تظل كل البيانات محفوظة. لا يمكن استخدام الموارد النشطة الزائدة في نشاط جديد حتى تخفّض الاستخدام أو ترقي الخطة. لن يُحذف أو يُؤرشف أي شيء تلقائيًا.',
  used: 'مستخدم', limit: 'الحد', over: 'زائد',
  resources: { active_locations: 'فروع المتجر', active_members: 'أفراد فريقك', active_products: 'المنتجات النشطة', active_services: 'الخدمات النشطة', active_customers: 'العملاء النشطون', active_suppliers: 'الموردون النشطون' },
}
</script>

<template>
  <div data-testid="shop-plan-cards">
    <fieldset class="mx-auto max-w-sm">
      <legend class="text-center text-sm font-bold">{{ copy.cycle }}</legend>
      <div class="mx-auto mt-2 grid max-w-xs grid-cols-2 rounded-full border border-border bg-muted p-1 shadow-inner" dir="ltr">
        <label v-for="option in (['monthly', 'annual'] as const)" :key="option" class="relative cursor-pointer">
          <input v-model="interval" class="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bs-link)]" type="radio" name="shop-billing-cycle" :value="option" :aria-label="option === 'monthly' ? copy.monthly : copy.yearly">
          <span class="block rounded-full px-6 py-2 text-center text-sm font-semibold transition" :class="interval === option ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'">{{ option === 'monthly' ? copy.monthly : copy.yearly }}</span>
        </label>
      </div>
      <p v-if="annualDiscount !== null" class="mt-2 text-center text-xs font-semibold text-muted-foreground">{{ copy.annualSaving(annualDiscount) }}</p>
    </fieldset>

    <div class="mt-6 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
      <BsCard v-for="offer in cards" :key="offer.planSlug" as="article" class="relative flex min-w-0 flex-col text-start" :class="isSelected(offer) ? 'border-[var(--bs-link)] ring-2 ring-[var(--bs-link)]/20' : ''" :data-plan="offer.planSlug" :data-variant="offer.planVariant">
        <div class="flex h-full flex-col">
        <StatusBadge v-if="isCurrent(offer)" class="absolute end-4 top-4" status="current" :label="copy.current" tone="info" />
        <h3 class="pe-20 text-xl font-extrabold">{{ familyName(offer) }}</h3>

        <fieldset v-if="offer.planSlug === 'multi'" class="mt-4">
          <legend class="text-xs font-bold text-muted-foreground">{{ copy.variants }}</legend>
          <div class="mt-2 grid grid-cols-2 rounded-xl border border-border bg-muted p-1" dir="ltr">
            <label v-for="variant in (['multi_2', 'multi_3'] as const)" :key="variant" class="relative cursor-pointer">
              <input v-model="multiVariant" class="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bs-link)]" type="radio" name="shop-multi-variant" :value="variant" :aria-label="variant === 'multi_2' ? copy.twoBranches : copy.threeBranches">
              <span class="block rounded-lg px-2 py-2 text-center text-sm font-bold transition" :class="multiVariant === variant ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'">{{ variant === 'multi_2' ? copy.twoBranches : copy.threeBranches }}</span>
            </label>
          </div>
        </fieldset>

        <div class="mt-5 min-h-24">
          <template v-if="interval === 'annual'">
            <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" dir="ltr">
              <s :aria-label="copy.original">{{ money(yearlyOriginal(offer), offer.currency) }}</s>
              <span class="rounded-full bg-[var(--bs-status-success-bg)] px-2 py-0.5 text-xs font-bold text-[var(--bs-status-success)]">{{ copy.discount(yearlyDiscount(offer)) }}</span>
            </div>
            <p class="mt-1 text-3xl font-black" dir="ltr">{{ money(offer.effectivePriceAmount, offer.currency) }}</p>
            <p class="text-xs text-muted-foreground">{{ copy.yearlyEquivalent(money(offer.effectivePriceAmount / 12, offer.currency), money(offer.effectivePriceAmount, offer.currency)) }}</p>
          </template>
          <template v-else>
            <p class="text-3xl font-black" dir="ltr">{{ money(offer.effectivePriceAmount, offer.currency) }}</p>
            <p class="text-xs text-muted-foreground">{{ copy.perMonth }}</p>
          </template>
          <p v-if="offer.priceSource === 'override' || offer.effectivePriceAmount !== offer.listPriceAmount" class="mt-2 text-xs font-bold text-[var(--bs-link)]">{{ copy.negotiated }} · {{ copy.publicList }}: {{ money(offer.listPriceAmount, offer.currency) }}</p>
        </div>

        <PlanResourceLimits class="mt-5" :limits="offer.resourceLimits" />

        <div v-if="offer.blockers.length" role="alert" class="mt-5 rounded-xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-3 text-sm">
          <strong>{{ copy.blocked }}</strong><p class="mt-1 leading-5">{{ copy.blockers }}</p>
          <ul class="mt-2 list-disc space-y-1 ps-5"><li v-for="blocker in offer.blockers" :key="blocker.resource">{{ resourceLabel(blocker.resource) }}: {{ blocker.used }} {{ copy.used }} / {{ blocker.limit }} {{ copy.limit }} · {{ blocker.excess }} {{ copy.over }}</li></ul>
          <p class="mt-3 font-semibold leading-5">{{ copy.preservation }}</p>
        </div>

        <NuxtLink v-if="action === 'signup'" to="/auth/signup" class="ls-btn ls-btn-primary mt-6 w-full text-center">{{ copy.startTrial }}</NuxtLink>
        <BsButton v-else type="button" class="mt-6 w-full" :variant="isSelected(offer) ? 'default' : 'primary'" :aria-pressed="isSelected(offer)" @click="emit('select', offer)">{{ isSelected(offer) ? copy.selected : copy.choose }}</BsButton>
        </div>
      </BsCard>
    </div>
  </div>
</template>
