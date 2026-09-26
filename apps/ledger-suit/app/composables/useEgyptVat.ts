import type { VatRpcDatabase } from '~~/types/vat-rpc.types'
import type { VatWorkspace } from '~/utils/egyptVat'

export function useEgyptVat() {
  const client = useSupabaseClient<VatRpcDatabase>()
  const user = useSupabaseUser()
  const { currentId, can } = useTenant()
  const today = new Date().toISOString().slice(0, 10)
  const from = ref(`${new Date().getUTCFullYear()}-01-01`)
  const to = ref(today)
  const workspace = ref<VatWorkspace | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
  let generation = 0

  async function load() {
    const request = ++generation
    workspace.value = null
    error.value = null
    if (!currentId.value || !user.value || !can('tax.read')) return
    pending.value = true
    try {
      const result = await client.rpc('read_egypt_vat_workspace', { p_organization_id: currentId.value, p_from_date: from.value, p_to_date: to.value })
      if (request !== generation) return
      if (result.error) throw result.error
      workspace.value = result.data as unknown as VatWorkspace
    }
    catch (failure) { if (request === generation) error.value = failure }
    finally { if (request === generation) pending.value = false }
  }

  async function command<Name extends 'configure_egypt_vat' | 'post_egypt_vat_document' | 'reverse_egypt_vat_document'>(name: Name, args: Omit<VatRpcDatabase['public']['Functions'][Name]['Args'], 'p_organization_id'>) {
    const organizationId = currentId.value
    if (!organizationId) throw new Error('Organization required')
    const result = await client.rpc(name, { ...args, p_organization_id: organizationId } as VatRpcDatabase['public']['Functions'][Name]['Args'])
    if (result.error) throw result.error
    if (organizationId === currentId.value) await load()
    return result.data
  }

  watch([currentId, () => user.value?.id], () => { void load() }, { flush: 'sync', immediate: true })
  onScopeDispose(() => { generation++; workspace.value = null })
  return { workspace, pending, error, from, to, load, command }
}

