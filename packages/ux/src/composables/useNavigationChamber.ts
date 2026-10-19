import { computed, ref, watch } from 'vue'

/** App-supplied destinations determine the active chamber; no product routes or permissions. */
export function useNavigationChamber(path: () => string, destinations: () => string[]) {
  const pathname = (value: string) => value.split(/[?#]/u)[0] || '/'
  const settingsPaths = computed(() => destinations().map(pathname))
  function isSettingsPath(value: string) {
    const current = pathname(value)
    return settingsPaths.value.some(target => current === target || target !== '/' && current.startsWith(`${target}/`))
  }
  const chamber = ref<'app' | 'settings'>(isSettingsPath(path()) ? 'settings' : 'app')
  watch([path, settingsPaths], () => { chamber.value = isSettingsPath(path()) ? 'settings' : 'app' })
  return { chamber, isSettingsPath }
}
