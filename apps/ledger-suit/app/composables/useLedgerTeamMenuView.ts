import type { Database } from '~~/types/database.types'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerTeamMenuView(_values: Record<string, unknown>, _emit: (event: string, ...args: unknown[]) => void) {
const _props = new Proxy(_values, { get: (target, key) => Reflect.get(target, key) ?? Reflect.get({
  showTrigger: true,
}, key) })
const showTrigger = computed(() => _props.showTrigger as boolean)
const supabase = useSupabaseClient<Database>()
const { currentId, can, roleLabel } = useTenant()
const { t } = useI18n()
const { open, show, close, markChanged } = useTeamInvitation()
const email = ref('')
const role = ref<string>('system:viewer')
const customRoles = ref<Array<{ id: string, name_en: string, name_ar: string }>>([])
const pending = ref(false)
const errorMessage = ref('')
const describeError = useErrorMessage()
const toasts = useToasts()
const { refresh: refreshPlanUsage } = usePlanUsage()

watch(open, async (isOpen) => {
  if (!isOpen || !currentId.value) return
  const { data } = await supabase.from('organization_roles').select('id, key, name_en, name_ar').eq('organization_id', currentId.value).order('created_at')
  customRoles.value = data ?? []
})

async function invite() {
  if (!currentId.value) return
  pending.value = true; errorMessage.value = ''
  const isCustom = role.value.startsWith('custom:')
  try {
    const { data, error } = await supabase.functions.invoke('send-invitation', {
      body: {
        organizationId: currentId.value,
        email: email.value,
        role: isCustom ? 'viewer' : role.value.slice(7),
        roleId: isCustom ? role.value.slice(7) : null,
      },
    })
    if (error) throw new Error(await edgeFunctionErrorMessage(error, t('errors.generic')))
    markChanged()
    if (!data?.sent) throw new Error(data?.warning ?? t('errors.generic'))
    await refreshPlanUsage()
    email.value = ''
    role.value = 'system:viewer'
    close()
    toasts.success(t('access.inviteSent'))
  }
  catch (error) { errorMessage.value = describeError(error) }
  finally { pending.value = false }
}
const { dirty: overlayDirty0 } = useRecordAction(() => ({ email: email.value, role: role.value }), computed(() => Boolean(open.value)))
const ledgerUsage = useLedgerUsagePresentation()
return { supabase, currentId, can, roleLabel, t, open, show, close, markChanged, email, role, customRoles, pending, errorMessage, describeError, toasts, refreshPlanUsage, invite, overlayDirty0, ledgerUsage, showTrigger }
}
