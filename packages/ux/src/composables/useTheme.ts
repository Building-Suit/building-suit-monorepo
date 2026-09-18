import { computed } from 'vue'
import { useState } from '#app'
export type ThemePreference = 'light' | 'dark' | 'system'
export const STORAGE_KEY = 'building-suit.theme'
export function useTheme() {
  const preference = useState<ThemePreference>('building-suit:theme', () => 'system')
  const systemDark = useState('building-suit:system-dark', () => false)
  const isDark = computed(() => preference.value === 'dark' || (preference.value === 'system' && systemDark.value))
  function apply(value: ThemePreference | boolean) {
    const mode = typeof value === 'boolean' ? value ? 'dark' : 'light' : value
    if (!import.meta.client) return
    if (mode === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', mode)
    document.documentElement.classList.toggle('dark', mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches))
  }
  function set(value: ThemePreference) {
    preference.value = value
    if (import.meta.client) { try { localStorage.setItem(STORAGE_KEY, value) } catch { /* Private mode can deny storage. */ } }
    apply(value)
  }
  function restore() {
    if (!import.meta.client) return
    systemDark.value = matchMedia('(prefers-color-scheme: dark)').matches
    let saved: string | null = null
    try { saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('ledger-suit.theme') || localStorage.getItem('bs-theme') } catch { /* Use system preference. */ }
    preference.value = saved === 'dark' || saved === 'light' ? saved : 'system'
    apply(preference.value)
  }
  return { preference, set, restore, isDark, toggle: () => set(isDark.value ? 'light' : 'dark'), apply }
}
