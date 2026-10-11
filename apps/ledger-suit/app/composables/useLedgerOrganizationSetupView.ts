import type { Database } from '~~/types/database.types'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerOrganizationSetupView(_values: Record<string, unknown>, _emit: (event: string, ...args: unknown[]) => void) {
const supabase = useSupabaseClient<Database>()
const { loadOrganizations } = useTenant()
const { t } = useI18n()
const describeError = useErrorMessage()
const route = useRoute()
const name = ref('')
const legalName = ref('')
const currency = ref('EGP')
const invitationToken = ref('')
const pending = ref(false)
const errorMessage = ref<string | null>(null)
const showDemo = ref(false)

onMounted(() => {
  if (typeof route.query.invitation === 'string') invitationToken.value = route.query.invitation
})

async function createOrganization() {
  pending.value = true; errorMessage.value = null
  try {
    const normalizedName = name.value.trim()
    const normalizedLegalName = legalName.value.trim()
    if (!normalizedName || !normalizedLegalName) {
      errorMessage.value = t('onboarding.completeRequired')
      return
    }

    const { data: isAvailable, error: availabilityError } = await supabase.rpc('check_legal_name_availability', {
      p_legal_name: normalizedLegalName,
    })
    if (availabilityError) throw availabilityError
    if (!isAvailable) {
      errorMessage.value = t('onboarding.legalNameTaken')
      return
    }

    const { error } = await supabase.rpc('create_organization', {
      p_name: normalizedName,
      p_legal_name: normalizedLegalName,
      p_base_currency: currency.value,
    })
    if (error) throw error
    await loadOrganizations(undefined, { force: true }); await refreshNuxtData()
  }
  catch (error) { errorMessage.value = describeError(error) }
  finally { pending.value = false }
}

async function acceptInvitation() {
  pending.value = true; errorMessage.value = null
  try {
    const { error } = await supabase.rpc('accept_organization_invitation' as never, { p_token: invitationToken.value.trim() } as never)
    if (error) throw error
    await loadOrganizations(undefined, { force: true }); await refreshNuxtData()
  }
  catch (error) { errorMessage.value = describeError(error) }
  finally { pending.value = false }
}
return { supabase, loadOrganizations, t, describeError, route, name, legalName, currency, invitationToken, pending, errorMessage, showDemo, createOrganization, acceptInvitation }
}
