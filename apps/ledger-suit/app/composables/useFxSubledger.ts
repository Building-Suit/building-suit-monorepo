import type { FxRpcDatabase, FxRevaluationLine } from '~~/types/fx-rpc.types'
import type { FxSubledgerType, FxWorkspace } from '~/utils/fxSubledger'

export function useFxSubledger(subledger: FxSubledgerType, asOf: Ref<string>) {
  const client = useSupabaseClient<FxRpcDatabase>()
  const { currentId, can } = useTenant()
  const user = useSupabaseUser()
  const data = shallowRef<FxWorkspace | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
  let generation = 0

  async function load() {
    const request = ++generation
    const organizationId = currentId.value
    if (!organizationId || !can('fx.read')) { data.value = null; return }
    pending.value = true
    error.value = null
    const result = await client.rpc('read_fx_workspace', { p_organization_id: organizationId, p_subledger_type: subledger, p_as_of_date: asOf.value })
    if (request !== generation) return
    if (result.error) error.value = result.error
    else data.value = result.data as unknown as FxWorkspace
    pending.value = false
  }

  async function command<Name extends keyof FxRpcDatabase['public']['Functions']>(name: Name, args: Omit<FxRpcDatabase['public']['Functions'][Name]['Args'], 'p_organization_id'>) {
    const organizationId = currentId.value
    if (!organizationId) throw new Error('Organization required')
    const result = await client.rpc(name, { ...args, p_organization_id: organizationId } as FxRpcDatabase['public']['Functions'][Name]['Args'])
    if (result.error) throw result.error
    await load()
    return result.data
  }

  async function preview(args: Omit<FxRpcDatabase['public']['Functions']['preview_fx_revaluation']['Args'], 'p_organization_id'>) {
    const organizationId = currentId.value
    if (!organizationId) throw new Error('Organization required')
    const result = await client.rpc('preview_fx_revaluation', { ...args, p_organization_id: organizationId })
    if (result.error) throw result.error
    return result.data as FxRevaluationLine[]
  }

  watch([currentId, () => user.value?.id, asOf, () => can('fx.read')], () => void load(), { immediate: true })
  onScopeDispose(() => { generation++ })
  return { data, pending, error, load, command, preview }
}
