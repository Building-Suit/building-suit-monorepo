import { accountingTablePreferenceKey, parseAccountingTableDensity, type AccountingTableDensity } from '~/utils/accountingTablePreferences'

export function useAccountingTablePreferences(tableId: string) {
  const config = useRuntimeConfig()
  const user = useSupabaseUser()
  const { currentId } = useTenant()
  const density = ref<AccountingTableDensity>('comfortable')
  const hydrated = ref(false)
  const storageKey = computed(() => user.value?.id && currentId.value
    ? accountingTablePreferenceKey({
        environment: String(config.public.supabase.url),
        userId: user.value.id,
        tenantId: currentId.value,
        tableId,
      })
    : '')

  function readPreference() {
    hydrated.value = false
    density.value = storageKey.value
      ? parseAccountingTableDensity(localStorage.getItem(storageKey.value))
      : 'comfortable'
    hydrated.value = true
  }

  onMounted(readPreference)
  watch(storageKey, () => { if (import.meta.client) readPreference() }, { flush: 'sync' })
  watch(density, value => {
    if (import.meta.client && hydrated.value && storageKey.value) localStorage.setItem(storageKey.value, value)
  }, { flush: 'sync' })

  return { density, hydrated }
}
