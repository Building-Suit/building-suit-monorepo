import type { DimensionRpcDatabase } from '~~/types/dimension-rpc.types'
import type { DimensionReport, DimensionWorkspace } from '~/utils/accountingDimensions'

export function useAccountingDimensions() {
  const client = useSupabaseClient<DimensionRpcDatabase>()
  const user = useSupabaseUser()
  const { currentId, can } = useTenant()
  const workspace = ref<DimensionWorkspace | null>(null)
  const report = ref<DimensionReport | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
  let generation = 0
  async function load() {
    const request = ++generation; workspace.value = null; report.value = null; error.value = null
    if (!currentId.value || !user.value || !can('dimensions.read')) return
    pending.value = true
    try {
      const result = await client.rpc('read_dimension_workspace', { p_organization_id: currentId.value })
      if (request !== generation) return
      if (result.error) throw result.error
      workspace.value = result.data as unknown as DimensionWorkspace
    }
    catch (failure) { if (request === generation) error.value = failure }
    finally { if (request === generation) pending.value = false }
  }
  async function loadReport(args: Omit<DimensionRpcDatabase['public']['Functions']['report_by_accounting_dimension']['Args'], 'p_organization_id'>) {
    if (!currentId.value) return
    const result = await client.rpc('report_by_accounting_dimension', { ...args, p_organization_id: currentId.value })
    if (result.error) throw result.error
    report.value = result.data as unknown as DimensionReport
  }
  async function command<Name extends 'save_dimension_value' | 'archive_dimension_value' | 'set_account_dimension_policy'>(name: Name, args: Omit<DimensionRpcDatabase['public']['Functions'][Name]['Args'], 'p_organization_id'>) {
    const organizationId = currentId.value
    if (!organizationId) throw new Error('Organization required')
    const result = await client.rpc(name, { ...args, p_organization_id: organizationId } as DimensionRpcDatabase['public']['Functions'][Name]['Args'])
    if (result.error) throw result.error
    if (organizationId === currentId.value) await load()
    return result.data
  }
  watch([currentId, () => user.value?.id], () => { void load() }, { flush: 'sync', immediate: true })
  onScopeDispose(() => { generation++; workspace.value = null; report.value = null })
  return { workspace, report, pending, error, load, loadReport, command }
}
