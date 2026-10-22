/** Named scheduling zones; the device suggestion is editable and grants no authority. */
export function doctorTimezoneChoices() {
  // supportedValuesOf omits valid IANA aliases and the fixed-offset Etc zones
  // already accepted by the scheduling contract and stored practice drafts.
  const fixed = ['Etc/UTC', 'Etc/GMT', ...Array.from({ length: 14 }, (_, i) => `Etc/GMT-${i + 1}`), ...Array.from({ length: 12 }, (_, i) => `Etc/GMT+${i + 1}`)]
  return [...new Set(['UTC', doctorSuggestedTimezone(), ...Intl.supportedValuesOf('timeZone'), ...fixed])]
    .map(value => ({ value, label: value.replaceAll('_', ' ') }))
}
export function doctorSuggestedTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
