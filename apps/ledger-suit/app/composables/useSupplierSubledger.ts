import type { ApRpcDatabase } from '~~/types/ap-rpc.types'
import type { ApWorkspace } from '~/utils/supplierSubledger'

export function useSupplierSubledger() {
  const client = useSupabaseClient<ApRpcDatabase>()
  const user = useSupabaseUser()
  const { currentId, can } = useTenant()
  const from = ref(`${new Date().getFullYear()}-01-01`)
  const asOf = ref(new Date().toISOString().slice(0, 10))
  const supplier = ref('')
  const data = ref<ApWorkspace | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
  let generation = 0

  async function load() {
    const request = ++generation
    data.value = null
    error.value = null
    pending.value = false
    if (!currentId.value || !user.value || !can('ap.read')) return
    pending.value = true
    try {
      const result = await client.rpc('read_ap_workspace', {
        p_organization_id: currentId.value,
        p_as_of_date: asOf.value,
        p_from: from.value,
        p_supplier_id: supplier.value || null,
      })
      if (request !== generation) return
      if (result.error) throw result.error
      data.value = result.data as unknown as ApWorkspace
    }
    catch (failure) { if (request === generation) error.value = failure }
    finally { if (request === generation) pending.value = false }
  }

  watch([currentId, () => user.value?.id], () => { supplier.value = ''; void load() }, { flush: 'sync' })
  watch([from, asOf, supplier, () => can('ap.read')], () => { void load() }, { immediate: true })
  onScopeDispose(() => { generation++; data.value = null })

  async function command<Name extends 'post_ap_document' | 'reverse_ap_document'>(name: Name, args: Omit<ApRpcDatabase['public']['Functions'][Name]['Args'], 'p_organization_id'>) {
    const organizationId = currentId.value
    if (!organizationId) throw new Error('Organization required')
    const result = await client.rpc(name, { ...args, p_organization_id: organizationId } as ApRpcDatabase['public']['Functions'][Name]['Args'])
    if (result.error) throw result.error
    if (organizationId === currentId.value) await load()
    return result.data
  }

  return { from, asOf, supplier, data, pending, error, load, command }
}
