import type { LandingContent } from '@building-suit/contracts'
import type { ShopPlanOffer } from '~/types/plans'
export function useShopLandingEntry() {



const { t, locale } = useI18n()
const analytics = useMarketingAnalytics()
const { feed: releaseFeed, state: releaseState, copy: releaseCopy, refresh: refreshReleases } = usePublicChangelog()
const landingChangelog = computed(() => ({
  title: locale.value === 'ar' ? 'ما الجديد' : 'What’s new',
  linkLabel: locale.value === 'ar' ? 'عرض سجل التحديثات الكامل' : 'View the full changelog',
  to: '/changelog', feed: releaseFeed.value, state: releaseState.value, copy: releaseCopy.value,
  locale: locale.value === 'ar' ? 'ar' as const : 'en' as const, suit: 'shop-suit',
}))
useHead({ title: 'Shop Suit · Building Suit', meta: [{ name: 'description', content: () => t('hero.description') }] })
const content = computed<LandingContent>(() => ({
  eyebrow: 'Shop Suit', heroTitle: `${t('hero.title')} ${t('hero.subtitle')}`, heroBody: t('hero.description'),
  createWorkspace: t('auth.signupAction'), explore: locale.value === 'ar' ? 'استكشف المميزات' : 'Explore features', trialNote: t('hero.noCreditCard'),
  featuresEyebrow: 'Shop Suit', featuresTitle: t('features.title'), featuresBody: t('features.description'),
  features: ['invoicesAndServices', 'employeesManagement', 'dashboardAndReports', 'expensesTracking'].map((key, i) => ({ icon: ['invoice', 'team', 'reports', 'wallet'][i]!, title: t(`features.${key}.title`), body: t(`features.${key}.description`) })),
  workflowEyebrow: locale.value === 'ar' ? 'طريقة العمل' : 'How it works', workflowTitle: locale.value === 'ar' ? 'من الإعداد إلى المتابعة اليومية' : 'From setup to daily operations',
  workflow: locale.value === 'ar' ? [ { title: 'أنشئ حسابك', body: 'أكد بريدك الإلكتروني وأكمل بيانات متجرك.' }, { title: 'أضف منتجاتك وخدماتك', body: 'نظم الكتالوج وسجل حركة المخزون.' }, { title: 'تابع العمل', body: 'راجع المصروفات والمخزون ولوحة التحكم.' } ] : [ { title: 'Create your account', body: 'Verify your email and complete your shop details.' }, { title: 'Add products and services', body: 'Organize your catalogue and record stock movements.' }, { title: 'Track operations', body: 'Review expenses, inventory and your dashboard.' } ],
  pricingEyebrow: locale.value === 'ar' ? 'الخطط' : 'Plans', pricingTitle: t('pricing.title'), pricingBody: t('pricing.description'),
}))

const { data: plans, isLoading, error, refresh } = usePlans()
const publicOffers = computed<ShopPlanOffer[]>(() => (plans.value ?? [])
  .filter(plan => plan.is_purchasable && !plan.is_coming_soon)
  .map(plan => ({
    catalogTermsId: plan.catalog_terms_id,
    planSlug: plan.slug,
    planName: plan.name,
    planVariant: plan.plan_variant,
    variantName: plan.variant_name,
    billingInterval: plan.billing_interval,
    currency: plan.currency,
    listPriceAmount: plan.price_amount,
    effectivePriceAmount: plan.price_amount,
    priceSource: 'catalog',
    resourceLimits: plan.resource_limits,
    blockers: [],
  })))

const publicPricing = reactive(useShopPlanPresentation({ get offers() { return publicOffers.value }, action: 'signup' }))
const landingPricing = computed(() => ({
  variant: 'shop' as const, interval: publicPricing.interval, plans: publicPricing.pricingPlans,
  intervalOptions: [{ value: 'monthly', label: publicPricing.copy.monthly }, { value: 'annual', label: publicPricing.copy.yearly }],
  copy: { cycleLabel: publicPricing.copy.cycle, loading: publicPricing.copy.loading, empty: t('pricing.empty'), retry: publicPricing.copy.retry, included: publicPricing.copy.included, notIncluded: publicPricing.copy.notIncluded },
  annualSaving: publicPricing.annualDiscount === null ? null : publicPricing.copy.annualSaving(publicPricing.annualDiscount),
  columns: 3 as const, intro: t('pricing.notes.allPlansIncludeFreeTrial'), loading: isLoading.value,
  error: error.value ? t('pricing.loadError') : null, testId: 'shop-plan-cards',
}))
function chooseInterval(value: string) { if (value === 'monthly' || value === 'annual') publicPricing.interval = value }
const view = computed(() => ({kind:'marketing' as const,content:content.value,preview:{kind:'features' as const},pricing:landingPricing.value,changelog:landingChangelog.value}))
return {view,chooseInterval,chooseVariant:publicPricing.chooseVariant,choose:publicPricing.choose,track:()=>analytics.track('pricing_cta'),refresh,refreshReleases}
}
