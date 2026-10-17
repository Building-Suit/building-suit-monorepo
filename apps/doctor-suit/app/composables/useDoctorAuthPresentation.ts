import { doctorAuthAvailability, doctorAuthCopy, doctorAuthError } from '../utils/authPresentation'

export function useDoctorAuthPresentation(initialize = true) {
  const { locale } = useI18n()
  const auth = useDoctorAuth()
  const ar = computed(() => locale.value === 'ar')
  const copy = computed(() => doctorAuthCopy(ar.value))
  const product = computed(() => ({ name: 'Doctor Suit', homeLabel: copy.value.home, title: copy.value.title, description: copy.value.description }))
  const availability = computed(() => doctorAuthAvailability(auth.state, ar.value))
  const error = computed(() => doctorAuthError(auth.state.error, ar.value))
  onMounted(() => { if (initialize && auth.state.phase === 'checking') void auth.refresh() })
  return { auth, ar, copy, product, availability, error }
}
