

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerSubscriptionGateView(_values: Record<string, unknown>, _emit: (event: string, ...args: unknown[]) => void) {
const { t } = useI18n()
const { current } = useTenant()
const { load, loading } = useBilling()
const route = useRoute()
const paymentFailed = computed(() => route.query.checkout === 'complete' && route.query.success === 'false')
const processing = computed(() => route.query.checkout === 'complete' && !paymentFailed.value)

function checkAgain() {
  return load({ force: true })
}
return { t, current, load, loading, route, paymentFailed, processing, checkAgain }
}
