<script setup lang="ts">
import type { Database } from '~~/types/database.types'

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
</script>

<template>
  <BsContextSwitcher :model-value="current?.id ?? null" :label="t('org.switcher')" :placeholder="t('org.none')" :options="contextOptions" :create-label="!ownsOrganization ? t('org.createAnother') : undefined" @update:model-value="value => { if (value) choose(value) }" @create="showCreate" />
  <BsRecordActionDialog v-if="createOpen" :visible="true" :title="t('org.createAnother')" size="md" :dirty="overlayDirty0" :pending="pending" :error="errorMessage" @update:visible="value => { if (!value) closeCreate() }" @submit="createAndStartTrial">
    <BsText tone="link" emphasis="semibold">{{ t('org.additionalEyebrow') }}</BsText>
    <BsText tone="muted">{{ t('org.additionalBillingHint') }}</BsText>
    <BsField :label="t('org.name')" required><template #default="field"><BsInput v-model="name" :id="field.id" required /></template></BsField>
    <BsField :label="t('onboarding.legalName')" required><template #default="field"><BsInput v-model="legalName" :id="field.id" required /></template></BsField>
    <BsField :label="t('accounts.currency')"><BsSelect v-model="currency" :label="t('accounts.currency')" :options="['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED']" /></BsField>
    <BsAlert tone="info" :title="t('org.separateSubscriptionTitle')" :description="t('org.separateSubscriptionBody')" />
    <template #actions="{ close }"><BsButton type="button" :disabled="pending" @click="close">{{ t('common.cancel') }}</BsButton><BsButton type="submit" variant="accent" :pending="pending">{{ t('org.createAndStartTrial') }}</BsButton></template>
  </BsRecordActionDialog>
</template>
