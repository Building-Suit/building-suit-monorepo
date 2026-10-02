<script setup lang="ts">
import type { Database } from '~~/types/database.types'

const supabase = useSupabaseClient<Database>()
const { organizations, current, setOrganization, loadOrganizations, roleLabel } = useTenant()
const { paymentRequired, load: loadBilling } = useBilling()
const { t } = useI18n()
const route = useRoute()
const describeError = useErrorMessage()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const createOpen = ref(false)
const name = ref('')
const legalName = ref('')
const currency = ref('EGP')
const pending = ref(false)
const errorMessage = ref('')
const ownsOrganization = computed(() => organizations.value.some(organization => organization.role === 'owner'))

useClickOutside(root, () => (open.value = false))

async function choose(id: string) {
  open.value = false
  const selected = await setOrganization(id)
  if (!selected) return
  await loadBilling()
  if (paymentRequired.value) await navigateTo('/subscribe')
  else if (route.path === '/subscribe') await navigateTo('/dashboard')
}

function showCreate() {
  open.value = false
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
  <div ref="root" class="relative">
    <BsButton
      type="button"
      class="ls-btn w-full justify-between"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-label="t('org.switcher')"
      @click="open = !open"
    >
      <span class="flex flex-col min-w-0 text-start">
        <span class="truncate">{{ current?.name ?? t('org.none') }}</span>
        <span v-if="current?.legal_name" class="truncate text-[10px] text-fg-muted">{{ current.legal_name }}</span>
      </span>
      <BsIcon name="arrowDown" class="text-fg-muted -me-3" />
    </BsButton>

    <ul
      v-if="open"
      class="ls-card absolute z-30 mt-1 w-full overflow-hidden p-1 shadow-overlay"
      role="listbox"
    >
      <li v-for="org in organizations" :key="org.id">
        <BsButton variant="chip"
          type="button"
          role="option"
          :aria-selected="org.id === current?.id"
          class="flex w-full items-center justify-between gap-2 rounded-chip px-2 py-2 text-start text-sm hover:bg-surface-muted"
          @click="choose(org.id)"
        >
          <span class="min-w-0">
            <span class="block truncate">{{ org.name }}</span>
            <span v-if="org.legal_name" class="block truncate text-[10px] text-fg-muted">{{ org.legal_name }}</span>
            <span class="block text-xs text-fg-muted">
              {{ roleLabel(org.role, org.role_id) }} · {{ org.base_currency }}
            </span>

            <BsStatusBadge :status="org.status === 'trial' ? 'trialing' : 'active'" />
          </span>
          <BsIcon v-if="org.id === current?.id" name="check" class="text-[var(--bs-status-success)]" />
        </BsButton>
      </li>
      <li v-if="!ownsOrganization" class="mt-1 border-t border-[var(--bs-border)] pt-1">
        <BsButton variant="text"
          type="button"
          class="flex w-full items-center gap-2 rounded-chip px-2 py-2 text-start text-sm font-semibold text-accent hover:bg-surface-muted"
          @click="showCreate"
        >
          <BsIcon name="add" :size="18" />
          <span>{{ t('org.createAnother') }}</span>
        </BsButton>
      </li>
    </ul>
        <BsRecordActionDialog v-if="createOpen" :visible="true" :title="t('org.createAnother')" size="md" :dirty="overlayDirty0" :pending="pending" :error="errorMessage" @update:visible="value => { if (!value) closeCreate() }" @submit="createAndStartTrial">
            <p class="text-sm font-semibold text-accent">{{ t('org.additionalEyebrow') }}</p>
            <p class="text-sm text-fg-muted">{{ t('org.additionalBillingHint') }}</p>

            <BsFloatingField :label="t('org.name')">
              <input id="additional-org-name" v-model="name" class="ls-input" required>
            </BsFloatingField>

            <BsFloatingField :label="t('onboarding.legalName')">
              <input id="additional-org-legal-name" v-model="legalName" class="ls-input" required>
            </BsFloatingField>

            <BsFloatingField :label="t('accounts.currency')">
              <select id="additional-org-currency" v-model="currency" class="ls-input">
                <option v-for="code in ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED']" :key="code">{{ code }}</option>
              </select>
            </BsFloatingField>

            <div class="rounded-control border border-[var(--bs-border)] bg-surface-muted p-3 text-sm">
              <p class="font-semibold">{{ t('org.separateSubscriptionTitle') }}</p>
              <p class="mt-1 text-fg-muted">{{ t('org.separateSubscriptionBody') }}</p>
            </div>

            <template #actions="{ close }">
              <BsButton type="button" :disabled="pending" @click="close">{{ t('common.cancel') }}</BsButton>
              <BsButton type="submit" variant="accent" :pending="pending">{{ t('org.createAndStartTrial') }}</BsButton>
            </template>
        </BsRecordActionDialog>
  </div>
</template>
