import type { DoctorPracticeSetup } from './practiceSetup'

/** Only a new admitted owner needs setup. Missing/revoked clinic grants do not
 * erase an existing practice or turn an invited secretary into an owner. */
export function doctorWorkspaceEntry(setup: DoctorPracticeSetup | null): string | null {
  if (!setup || setup.practice || setup.enrollment !== 'owner') return null
  return setup.subscriptionRequired ? '/subscription' : '/onboarding'
}
