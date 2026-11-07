import { watch } from 'vue'
import type { DoctorAuthState } from './authController'
import type { ManualPaymentState } from './manualPaymentController'
/** Resume reads after verified session replacement; never replay a payment command. */
export function watchManualPaymentSession(auth: DoctorAuthState, state: ManualPaymentState, active: () => boolean, refresh: () => Promise<void>) {
  let disposed = false, flight: Promise<void> | null = null
  const available = () => !disposed && active() && auth.phase === 'authenticated' && Boolean(auth.identity) && !auth.pending
    && !state.ready && !state.loading && !state.pending && !state.error && !state.uncertain
  function drain() {
    if (!available() || flight) return
    let failed = false
    flight = refresh().catch(() => { failed = true }).finally(() => {
      flight = null
      // A second invalidation can cancel the first read. Retry only after a
      // freshly verified identity, and stop on an explicit read error.
      if (!failed && available()) queueMicrotask(drain)
    })
  }
  const stop = watch(() => [auth.phase, auth.identity?.userId, auth.identity?.sessionId, auth.identity?.practiceId, auth.pending, state.ready, state.loading, state.pending, state.error, state.uncertain], drain)
  return () => { disposed = true; stop() }
}
