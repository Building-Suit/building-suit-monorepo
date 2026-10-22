/** Named scheduling zones; the device suggestion is editable and grants no authority. */
export function doctorTimezoneChoices() {
  return ['UTC', ...Intl.supportedValuesOf('timeZone')].map(value => ({ value, label: value.replaceAll('_', ' ') }))
}
export function doctorSuggestedTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
