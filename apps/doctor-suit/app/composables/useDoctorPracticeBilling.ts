import { practiceBillingCopy, practiceBillingView } from '../utils/practiceBillingPresentation'
export async function useDoctorPracticeBilling() {
 const controller = useNuxtApp().$doctorPracticeBilling, auth = useDoctorAuth(), { locale } = useI18n(), hydrated = ref(false)
 const copy = computed(() => practiceBillingCopy(locale.value === 'ar')), view = computed(() => practiceBillingView(controller, locale.value === 'ar', hydrated.value && !auth.state.pending && auth.state.phase === 'authenticated'))
 const priceFields = computed({ get: () => controller.state.priceForm, set: value => { if (!controller.state.pending && !controller.state.uncertain) controller.state.priceForm = { ...value } } })
 const chargeFields = computed({ get: () => controller.state.chargeForm, set: value => { if (!controller.state.pending && !controller.state.uncertain) controller.state.chargeForm = { ...value } } })
 const locationId = computed({ get: () => controller.state.locationId, set: value => { if (value) void controller.selectLocation(value) } })
 const stopAuth = watch(() => [auth.state.phase, auth.state.identity?.userId, auth.state.identity?.sessionId, auth.state.identity?.practiceId], () => controller.clear())
 let disposed = false, reading = false
 async function recoverRead() {
  if (disposed || reading || auth.state.phase !== 'authenticated' || !auth.state.identity?.practiceId || auth.state.pending || controller.state.loading || controller.state.pending || controller.state.uncertain || controller.state.error || controller.state.ready) return
  reading = true
  try { await controller.initialize() } finally { reading = false; if (!disposed && !controller.state.ready && !controller.state.error) queueMicrotask(() => { void recoverRead() }) }
 }
 const stopRead = watch(() => [controller.state.epoch, auth.state.pending], () => { void recoverRead() })
 onMounted(() => { hydrated.value = true; void recoverRead() })
 onBeforeUnmount(() => { disposed = true; stopAuth(); stopRead(); controller.clear() })
 await controller.initialize()
 return { controller, copy, view, priceFields, chargeFields, locationId }
}
