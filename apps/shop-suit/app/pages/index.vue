<script setup lang="ts">
import type { LandingContent } from '@building-suit/contracts'
import type { BsLandingJourney, BsLandingChangelog } from '@building-suit/ui/types/landingPresentation'
import type { ShopPlanOffer } from '~/types/plans'

definePageMeta({ layout: 'landing' })
const { t, locale } = useI18n()
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

const { feed: releaseFeed, state: releaseState, copy: releaseCopy, refresh: refreshReleases } = usePublicChangelog()
const landingChangelog = computed<BsLandingChangelog>(() => ({
  title: locale.value === 'ar' ? 'ما الجديد' : 'What’s new',
  linkLabel: locale.value === 'ar' ? 'عرض سجل التحديثات الكامل' : 'View the full changelog',
  to: '/changelog', feed: releaseFeed.value, state: releaseState.value, copy: releaseCopy.value,
  locale: locale.value === 'ar' ? 'ar' : 'en', suit: 'shop-suit',
}))

// Fictional sample transaction, projected from supported POS/receipt/report workflows.
// This is marketing presentation only: it never calls a business command or a print API.
const journey = computed<BsLandingJourney>(() => locale.value === 'ar' ? ({
  eyebrow: 'Shop Suit', title: 'كل عملية بيع. وصورة أوضح.',
  description: 'من أول طلب إلى آخر مراجعة لليوم. مساحة واحدة لمنتجاتك ومبيعاتك وفريقك، لتبقى قريبًا من تفاصيل متجرك.',
  primaryAction: t('auth.signupAction'), secondaryAction: 'اكتشف التفاصيل', note: t('hero.noCreditCard'),
  skip: 'انتقل إلى التفاصيل', scrollHint: 'مرّر لتتابع عملية البيع', illustrative: 'واجهة توضيحية · متجر ومعاملة تجريبيان',
  loading: { label: 'نجهّز لك التجربة…', continue: 'المتابعة إلى الموقع' },
  navigation: { dashboard: 'لوحة التحكم', pos: 'نقطة البيع', products: 'المنتجات', sales: 'المبيعات' },
  preview: {
    title: 'نظرة على يومك', subtitle: 'الموقع الرئيسي', total: 'الإجمالي', catalog: 'الكتالوج',
    customer: 'العميل', walkIn: 'عميل مباشر', item: 'كوب سيراميك', quantity: 'الكمية', amount: '١٥٠٫٠٠ ج.م', zero: '٠٫٠٠ ج.م',
    confirm: 'تأكيد', payment: 'نقدي · ١٥٠٫٠٠ ج.م', paid: 'مدفوع بالكامل', receipt: 'إيصال بيع', receiptNumber: 'DEMO-0042',
    print: 'طباعة', register: 'نقطة البيع', shop: 'متجر نواة', location: 'الموقع الرئيسي', staff: 'الموظف', staffName: 'نور',
    search: 'ابحث بالاسم أو رمز الصنف', all: 'كل الأصناف', inStock: 'متاح بالمخزون', cart: 'مراجعة البيع', empty: 'اختر صنفًا لبدء البيع',
    added: 'تمت إضافة كوب سيراميك', paymentLabel: 'طريقة الدفع', cash: 'نقدي', card: 'بطاقة', bank: 'تحويل بنكي',
    checkout: 'إتمام البيع', cancel: 'إلغاء', confirmationTitle: 'تأكيد البيع',
    confirmationBody: 'إتمام البيع وتسجيل الدفع الكامل؟', subtotal: 'المجموع الفرعي', date: 'التاريخ', dateValue: '١٩ أكتوبر ٢٠٢٦',
    share: 'مشاركة', printNote: 'تصوير بصري للطباعة التي تبدأها أنت من المتصفح.', thankYou: 'شكرًا لزيارتك',
    order: 'طلب العميل', orderRequest: 'كوب السيراميك هذا، من فضلك.',
    stockLabel: 'المخزون المتاح', stockBefore: '٢٤', stockAfter: '٢٣', salesCount: 'عدد البيعات', collections: 'التحصيلات',
    today: 'اليوم', recorded: 'بيع مسجّل',
    products: [
      { name: 'كوب سيراميك', price: '١٥٠٫٠٠ ج.م', sku: 'CUP-01', stock: '٢٤', artwork: 'cup' },
      { name: 'زجاجة يومية', price: '٢٨٠٫٠٠ ج.م', sku: 'BTL-02', stock: '١٨', artwork: 'bottle' },
      { name: 'وعاء سيراميك', price: '٢٢٠٫٠٠ ج.م', sku: 'BWL-03', stock: '١٢', artwork: 'bowl' },
      { name: 'تغليف هدية', price: '٣٠٫٠٠ ج.م', sku: 'SVC-01', stock: 'خدمة', artwork: 'service' },
    ],
  },
  chapters: [
    { eyebrow: '١ / مساحة العمل', title: 'يبدأ من متجرك.', body: 'اضبط بيانات نشاطك ومواقعك، وأضف فريقك وصلاحياته. ثم جهّز كتالوج المنتجات والخدمات.' },
    { eyebrow: '٢ / على الكاونتر', title: 'خلف كل طلب، بداية.', body: 'واجهة نقطة البيع على جهازك، وكتالوجك حاضر حين يطلب العميل.' },
    { eyebrow: '٣ / الاختيار', title: 'من الكتالوج إلى البيع.', body: 'ابحث عن الصنف، أضفه إلى البيع، وراجع الكمية. اختر عميلًا مسجّلًا أو تابع مع عميل مباشر.' },
    { eyebrow: '٤ / التأكيد', title: 'لحظة تستحق المراجعة.', body: 'راجع الإجمالي وطريقة الدفع، ثم أكّد إتمام البيع وتسجيل الدفع الكامل.' },
    { eyebrow: '٥ / الإيصال', title: 'تفاصيل تبقى في اليد.', body: 'إيصال محفوظ بتفاصيل الصنف والدفع والموظف. ابدأ الطباعة من المتصفح أو شارك صورة الإيصال.' },
    { eyebrow: '٦ / الأثر', title: 'عملية واحدة. أثر واضح.', body: 'البيع في سجلك، والمنتج في حركة مخزونك، والتحصيلات في لوحة متابعتك.' },
    { eyebrow: '٧ / الصورة الكاملة', title: 'أقرب إلى تفاصيل يومك.', body: 'المبيعات والمخزون والمصروفات وتقارير التشغيل. رؤية أوضح لتدير متجرك بثقة.' },
  ],
  trust: { label: 'Shop Suit', heading: 'أدر يومك بوضوح.', body: 'ابدأ بمتجرك. واجعل لكل عملية مكانها.' },
}) : ({
  eyebrow: 'Shop Suit', title: 'Every sale. A clearer picture.',
  description: 'From the first order to the last look at your day. One workspace for your catalogue, sales and team. Every detail, closer at hand.',
  primaryAction: t('auth.signupAction'), secondaryAction: 'Explore the details', note: t('hero.noCreditCard'),
  skip: 'Skip to the details', scrollHint: 'Scroll to follow one sale', illustrative: 'Illustrative interface · Fictional shop and transaction',
  loading: { label: 'Preparing your experience…', continue: 'Continue to site' },
  navigation: { dashboard: 'Dashboard', pos: 'Point of sale', products: 'Products', sales: 'Sales' },
  preview: {
    title: 'Your day, in view', subtitle: 'Main location', total: 'Total', catalog: 'Catalogue', customer: 'Customer',
    walkIn: 'Walk-in customer', item: 'Ceramic cup', quantity: 'Quantity', amount: 'EGP 150.00', zero: 'EGP 0.00',
    confirm: 'Confirm', payment: 'Cash · EGP 150.00', paid: 'Paid in full', receipt: 'Sale receipt', receiptNumber: 'DEMO-0042',
    print: 'Print', register: 'Point of sale', shop: 'Nawa store', location: 'Main location', staff: 'Staff', staffName: 'Nour',
    search: 'Search by name or SKU', all: 'All items', inStock: 'In stock', cart: 'Review sale', empty: 'Choose an item to start a sale',
    added: 'Ceramic cup added', paymentLabel: 'Payment method', cash: 'Cash', card: 'Card', bank: 'Bank transfer',
    checkout: 'Complete sale', cancel: 'Cancel', confirmationTitle: 'Confirm sale',
    confirmationBody: 'Complete this sale and record full payment?', subtotal: 'Subtotal', date: 'Date', dateValue: '19 October 2026',
    share: 'Share', printNote: 'A visual interpretation of printing you initiate in the browser.', thankYou: 'Thank you for visiting',
    order: 'At the counter', orderRequest: 'The ceramic cup, please.',
    stockLabel: 'Available stock', stockBefore: '24', stockAfter: '23', salesCount: 'Sales count', collections: 'Collections',
    today: 'Today', recorded: 'Sale recorded',
    products: [
      { name: 'Ceramic cup', price: 'EGP 150.00', sku: 'CUP-01', stock: '24', artwork: 'cup' },
      { name: 'Everyday bottle', price: 'EGP 280.00', sku: 'BTL-02', stock: '18', artwork: 'bottle' },
      { name: 'Ceramic bowl', price: 'EGP 220.00', sku: 'BWL-03', stock: '12', artwork: 'bowl' },
      { name: 'Gift wrapping', price: 'EGP 30.00', sku: 'SVC-01', stock: 'Service', artwork: 'service' },
    ],
  },
  chapters: [
    { eyebrow: '1 / The workspace', title: 'It starts with your shop.', body: 'Set up your business and locations. Give your team the right permissions. Make your catalogue your own.' },
    { eyebrow: '2 / The counter', title: 'Every order starts somewhere.', body: 'Your point of sale, on your device. Your catalogue, ready for the customer in front of you.' },
    { eyebrow: '3 / The selection', title: 'From catalogue to cart.', body: 'Find the item. Add it to the sale. Review the quantity. Select a saved customer, or serve a walk-in.' },
    { eyebrow: '4 / The confirmation', title: 'A moment to make sure.', body: 'Review the total and payment method. Then confirm the sale and record full payment.' },
    { eyebrow: '5 / The receipt', title: 'The details, made tangible.', body: 'A saved receipt with the item, payment and staff details. Start printing in your browser, or share a receipt image.' },
    { eyebrow: '6 / The record', title: 'One sale. A visible difference.', body: 'A sale in your history. A product movement in your stock. A collection reflected in your dashboard.' },
    { eyebrow: '7 / The bigger picture', title: 'Stay close to your day.', body: 'Sales, inventory, expenses and operational reports. A clearer view of the business you are building.' },
  ],
  trust: { label: 'Shop Suit', heading: 'Your day. In a better light.', body: 'Start with your shop. Give every detail its place.' },
}))

const subscriptionCurrency = useShopSubscriptionCurrency()
const { data: plans, isLoading, error, refresh } = usePlans(subscriptionCurrency.currency)
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
  currencySelection: subscriptionCurrency.selection.value,
  variant: 'shop' as const, interval: publicPricing.interval, plans: publicPricing.pricingPlans,
  intervalOptions: [{ value: 'monthly', label: publicPricing.copy.monthly }, { value: 'annual', label: publicPricing.copy.yearly }],
  copy: { cycleLabel: publicPricing.copy.cycle, loading: publicPricing.copy.loading, empty: t('pricing.empty'), retry: publicPricing.copy.retry, included: publicPricing.copy.included, notIncluded: publicPricing.copy.notIncluded },
  annualSaving: publicPricing.annualDiscount === null ? null : publicPricing.copy.annualSaving(publicPricing.annualDiscount),
  columns: 3 as const, intro: t('pricing.notes.allPlansIncludeFreeTrial'), loading: isLoading.value,
  error: error.value ? t('pricing.loadError') : null, testId: 'shop-plan-cards',
}))
function chooseInterval(value: string) { if (value === 'monthly' || value === 'annual') publicPricing.interval = value }
</script>
<template>
  <BsLandingPage :content="content" :preview="{ kind: 'features' }" :journey="journey" :pricing="landingPricing" :changelog="landingChangelog" signup-path="/auth/signup" @currency="subscriptionCurrency.choose($event)" @interval="chooseInterval" @variant="publicPricing.chooseVariant" @action="publicPricing.choose" @retry="refresh()" @changelog-retry="refreshReleases()"/>
</template>
