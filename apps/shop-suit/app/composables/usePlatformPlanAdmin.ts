import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { PlatformPlan, PlatformPlanShop } from '~/types/platformAdmin'
export async function usePlatformPlanAdmin(props: { mode: 'catalog' | 'shop'; shopId?: string | null; canMutate: boolean }, onChanged: () => void | Promise<void>) {
  const user = useSupabaseUser()
  const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
  const { locale } = useI18n()
  const confirmation = useConfirmation()
  const { push: pushToast } = useToasts()
  const isArabic = computed(() => locale.value === 'ar')
  const copy = computed(() => isArabic.value ? ar : en)
  const dialog = ref<'terms' | 'availability' | 'change' | 'override' | null>(null)
  const pending = ref(false)
  const commandError = ref('')
  const requestId = ref<string | null>(null)
  const selectedPlan = ref<PlatformPlan | null>(null)
  const resourceKeys = ['active_locations', 'active_members', 'active_products', 'active_services', 'active_customers', 'active_suppliers'] as const
  const terms = reactive({ displayName: '', billingInterval: 'monthly', currency: 'EGP', priceAmount: 0, effectiveFrom: '', active_locations: null as number | null, active_members: null as number | null, active_products: null as number | null, active_services: null as number | null, active_customers: null as number | null, active_suppliers: null as number | null, reason: '' })
  const availability = reactive({ isActive: false, isPublic: false, isPurchasable: false, isComingSoon: false, reason: '' })
  const subscriptionAction = reactive({ planId: '', timing: 'automatic', reason: '' })
  const price = reactive({ amount: 0, currency: 'EGP', effectiveFrom: '', expiresAt: '', reason: '' })
  const { dirty: dialogDirty } = useRecordAction(
    () => ({ dialog: dialog.value, terms, availability, subscriptionAction, price }),
    computed(() => Boolean(dialog.value)),
  )

  async function read<T>(resource: 'catalog' | 'shop') {
    const { data, error } = await rpc.rpc('platform_plan_read', {
      p_resource: resource, p_shop_id: resource === 'shop' ? props.shopId : null,
    })
    if (error) throw error
    return data as T
  }

  const { data: catalog, pending: catalogPending, error: catalogError, refresh: refreshCatalog } = await useAsyncData(
    () => `platform-admin:plans:${user.value?.id ?? 'anonymous'}:${props.mode}:catalog`,
    () => props.mode === 'catalog' ? read<{ items: PlatformPlan[] }>('catalog') : Promise.resolve(null),
    { watch: [() => props.mode] },
  )
  const { data: shopPlan, pending: shopPending, error: shopError, refresh: refreshShop } = await useAsyncData(
    () => `platform-admin:plans:${user.value?.id ?? 'anonymous'}:${props.mode}:shop:${props.shopId || 'none'}`,
    () => props.mode === 'shop' && props.shopId ? read<PlatformPlanShop>('shop') : Promise.resolve(null),
    { watch: [() => props.mode, () => props.shopId] },
  )

  function isoLocal(value = new Date()) {
    const offset = value.getTimezoneOffset() * 60_000
    return new Date(value.getTime() - offset).toISOString().slice(0, 16)
  }

  function openTerms(plan: PlatformPlan) {
    selectedPlan.value = plan
    Object.assign(terms, {
      displayName: plan.name, billingInterval: plan.billingInterval, currency: plan.currency,
      priceAmount: plan.priceAmount, effectiveFrom: isoLocal(),
      active_locations: plan.resourceLimits.active_locations ?? null,
      active_members: plan.resourceLimits.active_members ?? null,
      active_products: plan.resourceLimits.active_products ?? null,
      active_services: plan.resourceLimits.active_services ?? null,
      active_customers: plan.resourceLimits.active_customers ?? null,
      active_suppliers: plan.resourceLimits.active_suppliers ?? null, reason: '',
    })
    commandError.value = ''; requestId.value = null; dialog.value = 'terms'
  }

  function openAvailability(plan: PlatformPlan) {
    selectedPlan.value = plan
    Object.assign(availability, { isActive: plan.isActive, isPublic: plan.isPublic, isPurchasable: plan.isPurchasable, isComingSoon: plan.isComingSoon, reason: '' })
    commandError.value = ''; requestId.value = null; dialog.value = 'availability'
  }

  function openChange() {
    const current = shopPlan.value?.subscription
    subscriptionAction.planId = current?.planId || shopPlan.value?.availablePlans[0]?.planId || ''
    subscriptionAction.timing = 'automatic'; subscriptionAction.reason = ''
    commandError.value = ''; requestId.value = null; dialog.value = 'change'
  }

  function openOverride() {
    const current = shopPlan.value?.subscription
    Object.assign(price, { amount: current?.effectivePriceAmount || current?.listPriceAmount || 0, currency: current?.currency || 'EGP', effectiveFrom: isoLocal(), expiresAt: '', reason: '' })
    commandError.value = ''; requestId.value = null; dialog.value = 'override'
  }

  async function command(action: ShopRpcDatabase['public']['Functions']['platform_plan_command']['Args']['p_action'], options: { planId?: string | null; payload?: Record<string, unknown>; reason: string }) {
    if (!props.canMutate || pending.value) return
    if (options.reason.trim().length < 2) { commandError.value = copy.value.reasonRequired; return }
    pending.value = true; commandError.value = ''
    const id = requestId.value ?? globalThis.crypto.randomUUID()
    requestId.value = id
    try {
      const { error } = await rpc.rpc('platform_plan_command', {
        p_request_id: id, p_action: action, p_reason: options.reason.trim(),
        p_plan_id: options.planId ?? null, p_shop_id: props.mode === 'shop' ? props.shopId : null,
        p_payload: options.payload ?? {},
      })
      if (error) throw error
      requestId.value = null; dialog.value = null
      await Promise.all([refreshCatalog(), refreshShop()])
      onChanged()
      pushToast({ tone: 'success', title: copy.value.saved })
    }
    catch (error) { commandError.value = error instanceof Error ? error.message : copy.value.failed }
    finally { pending.value = false }
  }

  async function publishTerms() {
    const limits = Object.fromEntries(resourceKeys.map(key => [key, terms[key]]))
    if (!selectedPlan.value || !terms.displayName.trim() || !terms.effectiveFrom || terms.priceAmount < 0
      || Object.values(limits).some(value => value !== null && (!Number.isInteger(value) || value < 1))) {
      commandError.value = copy.value.invalidTerms; return
    }
    await command('publish_terms', { planId: selectedPlan.value.id, reason: terms.reason, payload: {
      displayName: terms.displayName.trim(), billingInterval: terms.billingInterval,
      currency: terms.currency.trim().toUpperCase(), priceAmount: terms.priceAmount,
      resourceLimits: limits, effectiveFrom: new Date(terms.effectiveFrom).toISOString(),
    } })
  }

  async function saveAvailability() {
    if (!selectedPlan.value) return
    if (availability.isPurchasable && !availability.isPublic) { commandError.value = copy.value.publicRequired; return }
    await command('set_availability', { planId: selectedPlan.value.id, reason: availability.reason, payload: {
      isActive: availability.isActive, isPublic: availability.isPublic,
      isPurchasable: availability.isPurchasable, isComingSoon: availability.isComingSoon,
    } })
  }

  const targetPlan = computed(() => shopPlan.value?.availablePlans.find(plan => plan.planId === subscriptionAction.planId) ?? null)

  async function changePlan() {
    if (!targetPlan.value) return
    if (targetPlan.value.blockers.length) { commandError.value = copy.value.blocked; return }
    await command('change_subscription', { planId: targetPlan.value.planId, reason: subscriptionAction.reason, payload: { timing: subscriptionAction.timing } })
  }

  async function simpleAction(action: 'renew_subscription' | 'suspend_subscription' | 'remove_price_override') {
    if (action === 'suspend_subscription' && !await confirmation.ask(copy.value.suspendConfirm)) return
    await command(action, { reason: subscriptionAction.reason || price.reason, payload: {} })
  }

  async function saveOverride() {
    if (!(price.amount > 0) || !price.effectiveFrom) { commandError.value = copy.value.invalidPrice; return }
    await command('set_price_override', { reason: price.reason, payload: {
      amount: price.amount, currency: price.currency, effectiveFrom: new Date(price.effectiveFrom).toISOString(),
      expiresAt: price.expiresAt ? new Date(price.expiresAt).toISOString() : null,
    } })
  }

  function money(amount: number, currency: string) {
    return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  }
  function date(value?: string | null) {
    return value ? new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
  }
  function limit(value: number | null | undefined) { return value == null ? copy.value.unlimited : String(value) }

  const en = {
    catalog: 'Plans', catalogHelp: 'Current and future-effective commercial catalog versions. Historical versions cannot be edited or deleted.',
    plan: 'Plan', state: 'State', price: 'List price', limits: 'Resource limits', version: 'Version', subscriptions: 'Subscriptions', actions: 'Actions',
    active: 'Active', inactive: 'Inactive', public: 'Public', private: 'Private', purchasable: 'Purchasable', unavailable: 'Unavailable', comingSoon: 'Coming soon',
    nextVersion: 'Scheduled version', effective: 'Effective', editTerms: 'Publish new version', availability: 'Availability', noPlans: 'No catalog plans.', loadFailed: 'Could not load plan controls.', retry: 'Retry',
    displayName: 'Display name', interval: 'Billing interval', currency: 'Currency', effectiveFrom: 'Effective from', reason: 'Reason', reasonRequired: 'Enter an explicit reason of at least two characters.', save: 'Apply and audit', cancel: 'Cancel', saved: 'The plan control was applied and audited.', failed: 'The plan control could not be applied.', invalidTerms: 'Enter valid terms, limits, price, and effective date.', publicRequired: 'A purchasable plan must be public.',
    active_locations: 'Locations', active_members: 'Members', active_products: 'Products', active_services: 'Services', active_customers: 'Customers', active_suppliers: 'Suppliers', unlimited: 'Unlimited',
    subscription: 'Customer subscription', currentPlan: 'Current plan', access: 'State', effectivePrice: 'Effective customer price', usage: 'Usage against enforced limits', pendingBilling: 'Pending billing requests', pendingChange: 'Scheduled plan change', noPendingChange: 'No scheduled plan change.',
    changePlan: 'Activate or switch plan', targetPlan: 'Target plan', timing: 'Timing', automatic: 'Automatic (upgrades now, downgrades at renewal)', immediate: 'Immediate operator override', periodEnd: 'Next renewal boundary', blockers: 'Downgrade blockers', blocked: 'The plan cannot be applied while the listed resources exceed its limits.', excess: 'over',
    renew: 'Renew one catalog term', suspend: 'Suspend subscription', suspendConfirm: 'Suspend this subscription? History remains readable while writes stop.', negotiatedPrice: 'Negotiated/founder price', setPrice: 'Set or change price', removePrice: 'Remove active override', amount: 'Amount', expiresAt: 'Optional expiry', invalidPrice: 'Enter a positive amount and effective date.', observer: 'Observer access is read-only.',
  }
  const ar = {
    catalog: 'الخطط', catalogHelp: 'إصدارات الكتالوج التجارية الحالية والمجدولة. لا يمكن تعديل أو حذف الإصدارات التاريخية.',
    plan: 'الخطة', state: 'الحالة', price: 'السعر المعلن', limits: 'حدود الموارد', version: 'الإصدار', subscriptions: 'الاشتراكات', actions: 'الإجراءات',
    active: 'نشطة', inactive: 'غير نشطة', public: 'عامة', private: 'خاصة', purchasable: 'متاحة للشراء', unavailable: 'غير متاحة', comingSoon: 'قريبًا',
    nextVersion: 'إصدار مجدول', effective: 'السريان', editTerms: 'نشر إصدار جديد', availability: 'الإتاحة', noPlans: 'لا توجد خطط.', loadFailed: 'تعذّر تحميل ضوابط الخطط.', retry: 'إعادة المحاولة',
    displayName: 'الاسم المعروض', interval: 'دورة الفوترة', currency: 'العملة', effectiveFrom: 'يسري من', reason: 'السبب', reasonRequired: 'اكتب سببًا صريحًا من حرفين على الأقل.', save: 'تطبيق وتسجيل', cancel: 'إلغاء', saved: 'تم تطبيق إجراء الخطة وتسجيله.', failed: 'تعذّر تطبيق إجراء الخطة.', invalidTerms: 'أدخل شروطًا وحدودًا وسعرًا وتاريخ سريان صالحًا.', publicRequired: 'يجب أن تكون الخطة المتاحة للشراء عامة.',
    active_locations: 'الفروع', active_members: 'الأعضاء', active_products: 'المنتجات', active_services: 'الخدمات', active_customers: 'العملاء', active_suppliers: 'الموردون', unlimited: 'غير محدود',
    subscription: 'اشتراك العميل', currentPlan: 'الخطة الحالية', access: 'الحالة', effectivePrice: 'السعر الفعلي للعميل', usage: 'الاستخدام مقابل الحدود المطبقة', pendingBilling: 'طلبات الفوترة المعلقة', pendingChange: 'تغيير خطة مجدول', noPendingChange: 'لا يوجد تغيير مجدول.',
    changePlan: 'تفعيل أو تغيير الخطة', targetPlan: 'الخطة المستهدفة', timing: 'التوقيت', automatic: 'تلقائي (الترقية الآن والتخفيض عند التجديد)', immediate: 'فوري بتجاوز صريح من المسؤول', periodEnd: 'عند التجديد القادم', blockers: 'عوائق التخفيض', blocked: 'لا يمكن تطبيق الخطة ما دامت الموارد المذكورة تتجاوز حدودها.', excess: 'زائد',
    renew: 'تجديد لمدة كتالوج واحدة', suspend: 'إيقاف الاشتراك', suspendConfirm: 'إيقاف الاشتراك؟ سيبقى السجل مقروءًا وتتوقف الكتابة.', negotiatedPrice: 'سعر تفاوضي/تأسيسي', setPrice: 'تعيين أو تغيير السعر', removePrice: 'إزالة التجاوز النشط', amount: 'المبلغ', expiresAt: 'انتهاء اختياري', invalidPrice: 'أدخل مبلغًا موجبًا وتاريخ سريان.', observer: 'صلاحية المراقب للقراءة فقط.',
  }

  return { rpc, locale, confirmation, pushToast, isArabic, copy, dialog, pending, commandError, requestId, selectedPlan, resourceKeys, terms, availability, subscriptionAction, price, dialogDirty, read, catalog, catalogPending, catalogError, refreshCatalog, shopPlan, shopPending, shopError, refreshShop, isoLocal, openTerms, openAvailability, openChange, openOverride, command, publishTerms, saveAvailability, targetPlan, changePlan, simpleAction, saveOverride, money, date, limit, en, ar }
}
