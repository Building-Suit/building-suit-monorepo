import type { BsAdminPlanCopy, BsAdminPlanDialog, BsAdminPlanForms, BsAdminPlanWorkspace } from '@building-suit/ui/types/platformAdministrationPresentation'
export function useShopPlatformPlanPresentation(controls: ReturnType<typeof reactive<Awaited<ReturnType<typeof usePlatformPlanAdmin>>>>) {
  const copy = computed<BsAdminPlanCopy>(() => ({
    ...Object.fromEntries(['catalog', 'catalogHelp', 'observer', 'plan', 'state', 'price', 'limits', 'version', 'subscriptions', 'actions', 'editTerms', 'availability', 'noPlans', 'loadFailed', 'retry', 'displayName', 'currency', 'interval', 'effectiveFrom', 'reason', 'save', 'cancel', 'active', 'public', 'purchasable', 'comingSoon', 'unlimited', 'targetPlan', 'timing', 'blockers', 'changePlan', 'renew', 'suspend', 'negotiatedPrice', 'amount', 'expiresAt', 'setPrice', 'removePrice', 'usage', 'pendingChange'].map(key => [key, controls.copy[key as keyof typeof controls.copy]])),
    locations: controls.copy.active_locations, members: controls.copy.active_members, products: controls.copy.active_products, services: controls.copy.active_services, customers: controls.copy.active_customers, suppliers: controls.copy.active_suppliers,
  } as BsAdminPlanCopy))
  const terms = computed<BsAdminPlanForms['terms']>({ get: () => ({ name: controls.terms.displayName, interval: controls.terms.billingInterval, currency: controls.terms.currency, amount: controls.terms.priceAmount, effectiveFrom: controls.terms.effectiveFrom, locations: controls.terms.active_locations, members: controls.terms.active_members, products: controls.terms.active_products, services: controls.terms.active_services, customers: controls.terms.active_customers, suppliers: controls.terms.active_suppliers, reason: controls.terms.reason }), set: value => Object.assign(controls.terms, { displayName: value.name, billingInterval: value.interval, currency: value.currency, priceAmount: value.amount, effectiveFrom: value.effectiveFrom, active_locations: value.locations, active_members: value.members, active_products: value.products, active_services: value.services, active_customers: value.customers, active_suppliers: value.suppliers, reason: value.reason }) })
  const availability = computed<BsAdminPlanForms['availability']>({ get: () => ({ active: controls.availability.isActive, public: controls.availability.isPublic, purchasable: controls.availability.isPurchasable, comingSoon: controls.availability.isComingSoon, reason: controls.availability.reason }), set: value => Object.assign(controls.availability, { isActive: value.active, isPublic: value.public, isPurchasable: value.purchasable, isComingSoon: value.comingSoon, reason: value.reason }) })
  const change = computed<BsAdminPlanForms['change']>({ get: () => ({ plan: controls.subscriptionAction.planId, timing: controls.subscriptionAction.timing, reason: controls.subscriptionAction.reason }), set: value => Object.assign(controls.subscriptionAction, { planId: value.plan, timing: value.timing, reason: value.reason }) })
  const price = computed<BsAdminPlanForms['price']>({ get: () => ({ ...controls.price }), set: value => Object.assign(controls.price, value) })
  const dialog = computed<BsAdminPlanDialog>(() => ({
    kind: controls.dialog, title: controls.dialog === 'terms' ? `${controls.copy.editTerms} · ${controls.selectedPlan?.name || ''}` : controls.dialog === 'availability' ? `${controls.copy.availability} · ${controls.selectedPlan?.name || ''}` : controls.dialog === 'change' ? controls.copy.changePlan : controls.copy.negotiatedPrice,
    dirty: controls.dialogDirty, pending: controls.pending, error: controls.commandError, plans: (controls.shopPlan?.availablePlans ?? []).map(plan => ({ value: plan.planId, label: `${plan.planName} · ${controls.money(plan.listPriceAmount, plan.currency)}` })), timing: [{ value: 'automatic', label: controls.copy.automatic }, { value: 'period_end', label: controls.copy.periodEnd }, { value: 'immediate', label: controls.copy.immediate }], blockers: (controls.targetPlan?.blockers ?? []).map(blocker => `${controls.copy[blocker.resource as keyof typeof controls.copy]}: ${blocker.used} / ${blocker.limit} (+${blocker.excess})`), canRemovePrice: !!controls.shopPlan?.subscription?.priceOverrideId,
  }))
  const view = computed<BsAdminPlanWorkspace>(() => ({ loading: controls.catalogPending, error: controls.catalogError ? controls.copy.loadFailed : null, dialog: dialog.value, rows: (controls.catalog?.items ?? []).map(plan => ({
    id: plan.id, name: plan.name, slug: plan.slug, state: `${plan.isActive ? controls.copy.active : controls.copy.inactive} · ${plan.isPublic ? controls.copy.public : controls.copy.private}`, availability: `${plan.isPurchasable ? controls.copy.purchasable : controls.copy.unavailable}${plan.isComingSoon ? ` · ${controls.copy.comingSoon}` : ''}`, price: `${controls.money(plan.priceAmount, plan.currency)} / ${plan.billingInterval}`, limits: controls.resourceKeys.map(key => ({ id: key, label: controls.copy[key], value: controls.limit(plan.resourceLimits[key]) })), version: `v${plan.catalogVersion} · ${controls.date(plan.effectiveFrom)}`, next: plan.nextTerms ? `${controls.copy.nextVersion} v${plan.nextTerms.version} · ${controls.date(plan.nextTerms.effectiveFrom)}` : '', subscriptions: String(plan.subscriptionCount),
  })) }))
  async function command(action: 'terms' | 'availability' | 'change' | 'override' | 'renew' | 'suspend' | 'removePrice' | 'close' | 'publishTerms' | 'saveAvailability' | 'saveChange' | 'savePrice', id?: string) {
    const plan = controls.catalog?.items.find(item => item.id === id)
    if (action === 'terms' && plan) controls.openTerms(plan)
    else if (action === 'availability' && plan) controls.openAvailability(plan)
    else if (action === 'change') controls.openChange()
    else if (action === 'override') controls.openOverride()
    else if (action === 'close') controls.dialog = null
    else if (action === 'publishTerms') await controls.publishTerms()
    else if (action === 'saveAvailability') await controls.saveAvailability()
    else if (action === 'saveChange') await controls.changePlan()
    else if (action === 'savePrice') await controls.saveOverride()
    else if (action === 'renew' || action === 'suspend') {
      if (controls.dialog === 'change') await controls.simpleAction(action === 'renew' ? 'renew_subscription' : 'suspend_subscription')
      else { controls.subscriptionAction.reason = ''; controls.commandError = ''; controls.requestId = null; controls.dialog = 'change' }
    }
    else if (action === 'removePrice') {
      if (controls.dialog === 'override') await controls.simpleAction('remove_price_override')
      else { controls.price.reason = ''; controls.commandError = ''; controls.requestId = null; controls.dialog = 'override' }
    }
  }
  return { copy, terms, availability, change, price, dialog, view, command }
}
