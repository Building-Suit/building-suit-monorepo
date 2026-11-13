import type { createDoctorPracticeController } from './practiceController'
import type { DoctorSetupForm } from './practiceSetup'

/** Continue the user's explicit final signup command after email verification.
 * Enrollment, entitlement and writes still use the current server contracts. */
export async function completeDoctorRegistration(
  practice: ReturnType<typeof createDoctorPracticeController>,
  values: DoctorSetupForm,
  current: () => boolean,
): Promise<string | null> {
  if (!current()) return null
  const loaded = await practice.load()
  if (!current()) return null
  const setup = practice.state.setup
  if (!loaded || !setup) return '/onboarding'
  if (setup.subscriptionRequired) return '/subscription'
  if (setup.practice || setup.enrollment === 'delegated-only') return '/workspace'
  const completed = await practice.complete(values)
  if (!current()) return null
  return completed ? '/workspace' : '/onboarding'
}
