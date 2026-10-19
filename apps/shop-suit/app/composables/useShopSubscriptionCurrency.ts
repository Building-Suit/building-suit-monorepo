import { useGuardedChoice } from '@building-suit/ux'
import { subscriptionCurrencyChoice } from '~/utils/subscription-currency.mjs'
import type { SubscriptionCurrency } from '~/utils/subscription-currency.mjs'
export function useShopSubscriptionCurrency(beforeChange?: (next: SubscriptionCurrency) => boolean | Promise<boolean>) {
  const cookie = useCookie<string | null>('shop-subscription-currency', { sameSite: 'lax', path: '/', maxAge: 31536000 })
  const hint = useRequestHeaders(['x-vercel-ip-country'])['x-vercel-ip-country'] ?? null
  const initial = subscriptionCurrencyChoice({ selectedCurrency: cookie.value === 'EGP' || cookie.value === 'USD' ? cookie.value : null, countryHint: hint })
  const currency = useShopState<SubscriptionCurrency>('shop:subscription-currency', () => initial.currency)
  const { locale } = useI18n()
  const guarded = useGuardedChoice(currency, ['EGP', 'USD'] as const, beforeChange)
  watch(currency, value => { cookie.value = value })
  const selection = computed(() => ({ value: currency.value, label: locale.value === 'ar' ? 'عملة الاشتراك' : 'Subscription currency',
    options: [{ value: 'EGP', label: 'EGP' }, { value: 'USD', label: 'USD' }], pending: guarded.pending.value,
    notice: currency.value === 'USD' ? (locale.value === 'ar' ? 'أسعار الدولار ثابتة. يتوقف تفعيل الدفع بالدولار على أهلية حساب التاجر؛ لا يتم التحويل تلقائياً إلى الجنيه.' : 'USD prices are fixed. USD checkout depends on merchant eligibility; no automatic switch to an EGP charge.') : '' }))
  return { currency, choose: guarded.choose, selection }
}
