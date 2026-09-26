import type { BankRpcDatabase } from '~~/types/bank-rpc.types'
import type { BankWorkspace } from '~/utils/bankReconciliation'

export function useBankReconciliation() {
  const client = useSupabaseClient<BankRpcDatabase>()
  const user = useSupabaseUser()
  const { currentId, can } = useTenant()
  const selectedId = ref('')
  const data = ref<BankWorkspace | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
  let generation = 0
  async function load() {
    const request = ++generation
    data.value = null; error.value = null
    if (!currentId.value || !user.value || !can('bank.read')) return
    pending.value = true
    try {
      const result = await client.rpc('read_bank_reconciliation_workspace', { p_organization_id: currentId.value, p_reconciliation_id: selectedId.value || null })
      if (request !== generation) return
      if (result.error) throw result.error
      data.value = result.data as unknown as BankWorkspace
      if (!selectedId.value && data.value.selected_id) selectedId.value = data.value.selected_id
    }
    catch (failure) { if (request === generation) error.value = failure }
    finally { if (request === generation) pending.value = false }
  }
  watch([currentId, () => user.value?.id], () => { selectedId.value = ''; data.value = null; void load() }, { flush: 'sync' })
  watch([selectedId, () => can('bank.read')], () => { void load() }, { immediate: true })
  onScopeDispose(() => { generation++; data.value = null })
  async function command<Name extends Exclude<keyof BankRpcDatabase['public']['Functions'], 'read_bank_reconciliation_workspace'>>(name: Name, args: Omit<BankRpcDatabase['public']['Functions'][Name]['Args'], 'p_organization_id'>) {
    const organizationId = currentId.value
    if (!organizationId) throw new Error('Organization required')
    const result = await client.rpc(name, { ...args, p_organization_id: organizationId } as BankRpcDatabase['public']['Functions'][Name]['Args'])
    if (result.error) throw result.error
    if (organizationId === currentId.value) await load()
    return result.data
  }
  return { selectedId, data, pending, error, load, command }
}
