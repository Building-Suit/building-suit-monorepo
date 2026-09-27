import type { ArRpcDatabase } from '~~/types/ar-rpc.types'
import type { ArWorkspace } from '~/utils/customerSubledger'

export function useCustomerSubledger() {
  const client = useSupabaseClient<ArRpcDatabase>()
  const user = useSupabaseUser()
  const { currentId, can } = useTenant()
  const from = ref(`${new Date().getFullYear()}-01-01`)
  const asOf = ref(new Date().toISOString().slice(0, 10))
  const customer = ref('')
  const data = ref<ArWorkspace | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
  let generation = 0
  // Component-scoped state, no persisted customer data or cross-session cache.
  async function load() {
    const request = ++generation
    data.value = null
    error.value = null
    pending.value = false
    if (!currentId.value || !user.value || !can('ar.read')) return
    pending.value = true
    try {
      const result = await client.rpc('read_ar_workspace', {
        p_organization_id: currentId.value, p_as_of_date: asOf.value,
        p_from: from.value, p_customer_id: customer.value || null,
      })
      if (request !== generation) return
      if (result.error) throw result.error
      data.value = result.data as unknown as ArWorkspace
    }
    catch (failure) { if (request === generation) error.value = failure }
    finally { if (request === generation) pending.value = false }
  }
  watch([currentId, () => user.value?.id], () => { customer.value = ''; void load() }, { flush: 'sync' })
  watch([from, asOf, customer, () => can('ar.read')], () => { void load() }, { immediate: true })
  onScopeDispose(() => { generation++; data.value = null })
  async function command<Name extends 'post_ar_document' | 'reverse_ar_document'>(name: Name, args: Omit<ArRpcDatabase['public']['Functions'][Name]['Args'], 'p_organization_id'>) {
    const organizationId = currentId.value
    if (!organizationId) throw new Error('Organization required')
    const result = await client.rpc(name, { ...args, p_organization_id: organizationId } as ArRpcDatabase['public']['Functions'][Name]['Args'])
    if (result.error) throw result.error
    if (organizationId === currentId.value) await load()
    return result.data
  }
  return { from, asOf, customer, data, pending, error, load, command }
}
