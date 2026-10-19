import { doctorPracticeCopy, doctorPracticeError } from '../utils/practicePresentation'
export function useDoctorPracticePresentation() {
  const { locale } = useI18n()
  const practice = useDoctorPractice()
  const ar = computed(() => locale.value === 'ar')
  const copy = computed(() => doctorPracticeCopy(ar.value))
  const error = computed(() => doctorPracticeError(practice.state.error, ar.value))
  return { practice, ar, copy, error }
}
