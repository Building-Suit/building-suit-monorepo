import type { Database } from '~~/types/database.types'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerOrganizationSwitcherView(_values: Record<string, unknown>, _emit: (event: string, ...args: unknown[]) => void) {
const supabase = useSupabaseClient<Database>()
const { organizations, current, setOrganization, loadOrganizations, roleLabel } = useTenant()
const { paymentRequired, load: loadBilling } = useBilling()
const { t } = useI18n()
const route = useRoute()
const describeError = useErrorMessage()

const createOpen = ref(false)
const name = ref('')
const legalName = ref('')
const currency = ref('EGP')
const pending = ref(false)
const errorMessage = ref('')
const ownsOrganization = computed(() => organizations.value.some(organization => organization.role === 'owner'))
const contextOptions = computed(() => organizations.value.map(organization => ({
  id: organization.id,
  label: organization.name,
  description: organization.legal_name || undefined,
  meta: `${roleLabel(organization.role, organization.role_id)} · ${organization.base_currency}`,
  status: organization.status,
})))

async function choose(id: string) {
  const selected = await setOrganization(id)
  if (!selected) return
  await loadBilling()
  if (paymentRequired.value) await navigateTo('/subscribe')
  else if (route.path === '/subscribe') await navigateTo('/dashboard')
}

function showCreate() {
  createOpen.value = true
  name.value = ''
  legalName.value = ''
  currency.value = current.value?.base_currency ?? 'EGP'
  errorMessage.value = ''
}

function closeCreate() {
  if (!pending.value) createOpen.value = false
}

async function createAndStartTrial() {
  pending.value = true
  errorMessage.value = ''
  try {
    const normalizedName = name.value.trim()
    const normalizedLegalName = legalName.value.trim()
    if (!normalizedName || !normalizedLegalName) {
      errorMessage.value = t('onboarding.completeRequired')
      return
    }

    // This gives immediate feedback. The unique index inside
    // create_organization remains the authoritative race-safe check.
    const { data: isAvailable, error: availabilityError } = await supabase.rpc('check_legal_name_availability', {
      p_legal_name: normalizedLegalName,
    })
    if (availabilityError) throw availabilityError
    if (!isAvailable) {
      errorMessage.value = t('onboarding.legalNameTaken')
      return
    }

    const { data: organizationId, error } = await supabase.rpc('create_organization', {
      p_name: normalizedName,
      p_legal_name: normalizedLegalName,
      p_base_currency: currency.value,
    })
    if (error) throw error
    if (!organizationId) throw new Error(t('billing.checkoutFailed'))
    await loadOrganizations(undefined, { force: true })
    await setOrganization(organizationId)
    await loadBilling({ force: true })
    createOpen.value = false
    if (route.path === '/subscribe') await navigateTo('/dashboard')
  }
  catch (error) {
    errorMessage.value = describeError(error)
  }
  finally {
    pending.value = false
  }
}

const { dirty: overlayDirty0 } = useRecordAction(() => ({ name: name.value, legalName: legalName.value, currency: currency.value }), computed(() => createOpen.value))
return { supabase, organizations, current, setOrganization, loadOrganizations, roleLabel, paymentRequired, loadBilling, t, route, describeError, createOpen, name, legalName, currency, pending, errorMessage, ownsOrganization, contextOptions, choose, showCreate, closeCreate, createAndStartTrial, overlayDirty0 }
}
