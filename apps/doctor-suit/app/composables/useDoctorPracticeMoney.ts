import { doctorUuid } from '../utils/locationContext'
import { practiceMoneyCopy, practiceMoneyView } from '../utils/practiceMoneyPresentation'
import type { PaymentAction } from '../utils/practiceMoneyRepository'
export async function useDoctorPracticeMoney() {
 const controller = useNuxtApp().$doctorPracticeMoney, auth = useDoctorAuth(), route = useRoute(), { locale } = useI18n(), hydrated = ref(false), confirmation = useConfirmation()
 const copy = computed(() => practiceMoneyCopy(locale.value === 'ar')), view = computed(() => practiceMoneyView(controller, locale.value === 'ar', hydrated.value))
 const form = computed({ get: () => controller.state.form, set: value => { if (!controller.state.pending && !controller.state.uncertain) controller.state.form = { ...value } } })
 function query() { const a = auth.state.identity, location = route.query.location, charge = route.query.charge; return a?.practiceId && doctorUuid(location) && doctorUuid(charge) ? { userId: a.userId, practiceId: a.practiceId, locationId: location as string, chargeId: charge as string } : null }
 let disposed = false, reading = false, attempted: string | null = null
 async function load() { if (disposed || reading || auth.state.pending || auth.state.phase !== 'authenticated') return; const selected = query(), stamp = JSON.stringify([auth.state.identity?.sessionId, selected]); if (controller.state.error === 'denied' && attempted === stamp) return; attempted = stamp; reading = true; try { await controller.select(selected) } finally { reading = false } }
 const stopAuth = watch(() => [auth.state.phase, auth.state.identity?.userId, auth.state.identity?.sessionId, auth.state.identity?.practiceId], () => controller.clear())
 const stopRead = watch(() => [controller.state.epoch, auth.state.pending, route.query.location, route.query.charge], () => { void load() })
 async function advance(id: string, revision: number, action: PaymentAction, outcome: 'accepted' | 'rejected' | null) {
  const title = action === 'reconcile' ? copy.value.reconcile : action === 'cancel' ? copy.value.cancelPending : outcome === 'accepted' ? copy.value.accept : copy.value.reject
  if (await confirmation.ask({ title, message: copy.value.confirmMessage, confirmLabel: copy.value.confirm, cancelLabel: copy.value.cancel })) await controller.advance(id, revision, action, outcome)
 }
 onMounted(() => { hydrated.value = true; void load() })
 onBeforeUnmount(() => { disposed = true; stopAuth(); stopRead(); controller.clear() })
 await load()
 return { controller, copy, view, form, advance, refresh: () => controller.select(query()) }
}
