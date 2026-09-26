import type { InventoryRpcDatabase } from '~~/types/inventory-rpc.types'
import type { InventoryWorkspace } from '~/utils/inventoryAccounting'

export function useInventoryAccounting() {
  const client = useSupabaseClient<InventoryRpcDatabase>()
  const user = useSupabaseUser()
  const { currentId, can } = useTenant()
  const route = useRoute()
  const asOf = ref(typeof route.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.date) ? route.query.date : new Date().toISOString().slice(0, 10))
  const factId = computed(() => typeof route.query.fact === 'string' ? route.query.fact : undefined)
  const offset = ref(0)
  const workspace = ref<InventoryWorkspace | null>(null)
  const pending = ref(false)
  const error = ref(false)
  let generation = 0
  async function load() {
    const request = ++generation
    workspace.value = null; error.value = false; pending.value = false
    if (!currentId.value || !user.value || !can('inventory.read')) return
    pending.value = true
    try {
      const result = await client.rpc('read_inventory_workspace', { p_organization_id: currentId.value, p_as_of_date: asOf.value, p_offset: offset.value, p_limit: 25, p_fact_id: factId.value })
      if (request !== generation) return
      if (result.error) throw result.error
      workspace.value = result.data as unknown as InventoryWorkspace
    }
    catch { if (request === generation) error.value = true }
    finally { if (request === generation) pending.value = false }
  }
  async function command<Name extends 'configure_inventory_source' | 'create_inventory_control_account'>(name: Name, args: Omit<InventoryRpcDatabase['public']['Functions'][Name]['Args'], 'p_organization_id'>) {
    const organizationId = currentId.value
    const actor = user.value?.id
    if (!organizationId || !actor) throw new Error('Organization required')
    const result = await client.rpc(name, { ...args, p_organization_id: organizationId } as InventoryRpcDatabase['public']['Functions'][Name]['Args'])
    if (result.error) throw result.error
    if (organizationId === currentId.value && actor === user.value?.id) await load()
    return result.data
  }
  watch([currentId, () => user.value?.id, () => can('inventory.read'), factId], () => { offset.value = 0; void load() }, { flush: 'sync', immediate: true })
  onScopeDispose(() => { generation++; workspace.value = null })
  return { asOf, offset, workspace, pending, error, load, command }
}
