import type { AssetRpcDatabase } from '~~/types/asset-rpc.types'
import type { FixedAssetWorkspace } from '~/utils/fixedAssets'

export function useFixedAssets() {
  const client = useSupabaseClient<AssetRpcDatabase>()
  const user = useSupabaseUser()
  const { currentId, can } = useTenant()
  const asOfDate = ref(new Date().toISOString().slice(0, 10))
  const data = ref<FixedAssetWorkspace | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
  let generation = 0
  async function load() {
    const request = ++generation
    data.value = null; error.value = null
    if (!currentId.value || !user.value || !can('assets.read')) return
    pending.value = true
    try {
      const result = await client.rpc('read_fixed_asset_workspace', { p_organization_id: currentId.value, p_as_of_date: asOfDate.value })
      if (request !== generation) return
      if (result.error) throw result.error
      data.value = result.data as unknown as FixedAssetWorkspace
    }
    catch (failure) { if (request === generation) error.value = failure }
    finally { if (request === generation) pending.value = false }
  }
  watch([currentId, () => user.value?.id], () => { data.value = null; void load() }, { flush: 'sync' })
  watch([asOfDate, () => can('assets.read')], () => { void load() }, { immediate: true })
  onScopeDispose(() => { generation++; data.value = null })
  async function command<Name extends Exclude<keyof AssetRpcDatabase['public']['Functions'], 'read_fixed_asset_workspace'>>(name: Name, args: Omit<AssetRpcDatabase['public']['Functions'][Name]['Args'], 'p_organization_id'>) {
    const organizationId = currentId.value
    if (!organizationId) throw new Error('Organization required')
    const result = await client.rpc(name, { ...args, p_organization_id: organizationId } as AssetRpcDatabase['public']['Functions'][Name]['Args'])
    if (result.error) throw result.error
    if (organizationId === currentId.value) await load()
    return result.data
  }
  return { asOfDate, data, pending, error, load, command }
}
