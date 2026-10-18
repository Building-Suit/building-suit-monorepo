import { watch } from 'vue'
import type { DoctorAuthState } from '../utils/authController.ts'
import type { createDoctorPracticeController } from '../utils/practiceController.ts'
import { doctorSetupForm, type DoctorPracticeSetup } from '../utils/practiceSetup.ts'

interface PracticeForm { name: string; workspaceName: string; locationName: string; timezone: string }

// Provider invalidation clears practice state. Resume only after a verified
// scope returns, and obtain the draft again from the authorized repository.
export function useDoctorOnboardingDraft(auth: DoctorAuthState, practice: ReturnType<typeof createDoctorPracticeController>, form: { value: PracticeForm }) {
  let scope: string | null | undefined
  let applied: DoctorPracticeSetup | null = null
  function clear() {
    applied = null
    Object.assign(form.value, { name: '', workspaceName: '', locationName: '', timezone: '' })
  }
  return watch(() => [auth.phase, auth.identity?.userId, auth.identity?.sessionId, auth.identity?.practiceId, practice.state.phase, practice.state.pending, practice.state.setup], () => {
    const actor = auth.phase === 'authenticated' ? auth.identity : null
    const next = actor ? JSON.stringify([actor.userId, actor.sessionId, actor.practiceId]) : null
    if (next !== scope) {
      const initialized = scope !== undefined
      scope = next
      clear()
      if (initialized) practice.clear()
    }
    if (!next) { clear(); return }
    if (practice.state.phase === 'idle' && !practice.state.pending) {
      clear()
      void practice.load()
      return
    }
    const setup = practice.state.setup
    if (!setup || practice.state.phase === 'loading' || practice.state.phase === 'denied' || setup.subscriptionRequired || setup.enrollment !== 'owner') { clear(); return }
    if (applied !== setup) {
      const values = doctorSetupForm(setup)
      Object.assign(form.value, { name: values.displayName, workspaceName: values.practiceName, locationName: values.locationName, timezone: values.timezone })
      applied = setup
    }
  }, { immediate: true })
}
