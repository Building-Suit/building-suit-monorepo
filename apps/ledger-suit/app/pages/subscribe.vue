<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { t } = useI18n()
const { current, loadOrganizations } = useTenant()
const { paymentRequired, loading, load } = useBilling()
const { restore } = useTheme()
const route = useRoute()
const redirecting = ref(false)
const checkoutConfirmationActive = ref(false)
const paymentFailed = computed(() => route.query.checkout === 'complete' && route.query.success === 'false')
const processing = computed(() => route.query.checkout === 'complete' && !paymentFailed.value)

useHead({ title: () => `${t('billing.title')} · ${t('app.name')}` })

await loadOrganizations()
await load()
onMounted(() => {
  restore()
  if (processing.value) {
    checkoutConfirmationActive.value = true
    void confirmCheckout()
  }
})
onBeforeUnmount(() => (checkoutConfirmationActive.value = false))

async function confirmCheckout() {
  // Paymob redirects before its webhook is guaranteed to have updated our
  // subscription row. Poll briefly, then leave an explicit retry button rather
  // than issuing unbounded background requests.
  for (let attempt = 0; attempt < 10 && paymentRequired.value && checkoutConfirmationActive.value; attempt++) {
    try {
      await load({ force: true })
    }
    catch {
      return
    }
    if (!paymentRequired.value) return
    if (attempt < 9) await new Promise(resolve => setTimeout(resolve, 1_500))
  }
}

watch([current, loading, paymentRequired], async () => {
  if (!current.value || loading.value || paymentRequired.value || redirecting.value) return
  redirecting.value = true
  await navigateTo('/dashboard', { replace: true })
}, { immediate: true })

async function signOut() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <BsAppShell :product-name="t('app.name')" :groups="[]" :labels="{ close: t('nav.close'), open: t('nav.open'), navigation: t('nav.primary'), dashboard: t('nav.dashboard') }">
    <template #logo><BsProductLogo name="Ledger Suit" asset-prefix="/brand/ledger-suit" class="h-14 w-auto max-w-52" /></template>
    <template #context><OrganizationSwitcher v-if="current" /></template>
    <template #header><BsUserMenu :email="user?.email" :account-label="t('common.accountMenu')" :sign-out-label="t('common.signOut')" @sign-out="signOut" /></template>
    <div v-if="loading" class="py-16 text-center text-sm text-fg-muted">{{ t('app.loading') }}</div>
    <SubscriptionGate v-else-if="current && paymentRequired" />
  </BsAppShell>
</template>
