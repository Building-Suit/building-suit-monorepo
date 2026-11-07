// Owned-runner failure diagnostics only. Never retain field values, labels, IDs,
// validation messages, identity, credentials, URLs or application state objects.
export async function installDoctorEntryValidity(page) {
  await page.addInitScript(() => {
    const lastInvalid = [], events = []
    function state(control) {
      const label = [...(control.labels || [])].map(item => item.textContent || '').join(' ')
      const field = control.type === 'password' ? 'password'
        : control.type === 'email' ? 'email'
          : /^(Doctor display name|Display name|الاسم المعروض للطبيب|الاسم المعروض)/.test(label) ? 'display_name'
            : /^(Practice name|اسم الممارسة)/.test(label) ? 'practice_name'
              : /^(First location name|Location name|اسم الموقع)/.test(label) ? 'location_name'
                : /^(Timezone|IANA timezone|المنطقة الزمنية)/.test(label) ? 'timezone' : 'other'
      return { field, provided: typeof control.value === 'string' && control.value.trim().length > 0,
        required: Boolean(control.required), disabled: Boolean(control.disabled), connected: control.isConnected,
        valid: control.validity?.valid === true, missing: control.validity?.valueMissing === true,
        tooShort: control.validity?.tooShort === true, tooLong: control.validity?.tooLong === true,
        typeMismatch: control.validity?.typeMismatch === true, patternMismatch: control.validity?.patternMismatch === true }
    }
    document.addEventListener('invalid', event => {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement)) return
      lastInvalid.push(state(event.target));if (lastInvalid.length > 8) lastInvalid.shift()
    }, true)
    for (const kind of ['focusin', 'input', 'change']) document.addEventListener(kind, event => {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement)) return
      const control = state(event.target)
      events.push({ kind, field: control.field, provided: control.provided, entering: Boolean(document.querySelector('.bs-auth-wizard-stage-enter-active')) })
      if (events.length > 12) events.shift()
    }, true)
    window.__doctorEntrySafeValidity = () => ({
      controls: [...document.querySelectorAll('form input,form select,form textarea')].slice(0, 16).map(state),
      lastInvalid: [...lastInvalid], events: [...events],
      entering: Boolean(document.querySelector('.bs-auth-wizard-stage-enter-active')),
      leaving: Boolean(document.querySelector('.bs-auth-wizard-stage-leave-active')),
      stageCount: Math.min(3, document.querySelectorAll('.bs-signup-wizard__content').length),
    })
  })
}
export async function readDoctorEntryValidity(page) {
  return page.evaluate(() => window.__doctorEntrySafeValidity?.() || { unavailable: true })
}
