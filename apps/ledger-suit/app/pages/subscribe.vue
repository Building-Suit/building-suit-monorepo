<script setup lang="ts">
import { useBoundedPolling } from '@building-suit/ux'
import { useLedgerBillingPresentation } from '~/composables/useLedgerBillingPresentation'
import { useLedgerWorkspacePresentation } from '~/composables/useLedgerWorkspacePresentation'
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { t } = useI18n()
const { current, loadOrganizations } = useTenant()
const { paymentRequired, loading, load } = useBilling()
const { restore } = useTheme()
const route = useRoute()
const redirecting = ref(false)
const paymentFailed = computed(() => route.query.checkout === 'complete' && route.query.success === 'false')
const processing = computed(() => route.query.checkout === 'complete' && !paymentFailed.value)

useHead({ title: () => `${t('billing.title')} · ${t('app.name')}` })

await loadOrganizations()
await load()
onMounted(() => {
  restore()
  if (processing.value) {
    void checkoutPolling.start()
  }
})
const checkoutPolling = useBoundedPolling(async () => {
  if (!paymentRequired.value) return true
  try { await load({ force: true }) } catch { return true }
  return !paymentRequired.value
}, { attempts: 10, delay: 1500 })

watch([current, loading, paymentRequired], async () => {
  if (!current.value || loading.value || paymentRequired.value || redirecting.value) return
  redirecting.value = true
  await navigateTo('/dashboard', { replace: true })
}, { immediate: true })

async function signOut() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}

const billing = useLedgerBillingPresentation({ surface: 'checkout' })
const workspace = useLedgerWorkspacePresentation()
const checkoutWorkspace = computed(() => ({ productName: t('app.name'), email: user.value?.email, accountLabel: t('common.accountMenu'), signOut: t('common.signOut'), assetPrefix: '/brand/ledger-suit', labels: { close: t('nav.close'), open: t('nav.open'), navigation: t('nav.primary'), dashboard: t('nav.dashboard') }, selector: workspace.selector.value }))
const checkoutGate = computed(() => ({ loading: loading.value, visible: !!current.value && paymentRequired.value, eyebrow: t('billing.singlePlan'), title: t('billing.unlock', { organization: current.value?.name }), description: t('billing.gateDescription'), features: [t('billing.featureAccounting'), t('billing.featureAutomation'), t('billing.featureTeam')], processing: processing.value, processingLabel: t('billing.confirming'), retry: t('billing.checkAgain'), failed: paymentFailed.value ? t('billing.paymentFailed') : '' }))
</script>
<template>
  <BsSubscriptionCheckoutPage v-model:form="billing.form.value" v-model:creation-form="workspace.form.value" :copy="billing.copy.value" :view="billing.view.value" :manual="billing.manualView.value" :impact="billing.impact.value" :workspace="checkoutWorkspace" :creation="workspace.view.value" :gate="checkoutGate" @sign-out="signOut" @workspace="workspace.choose" @create-workspace="workspace.open" @close-creation="workspace.close" @submit-creation="workspace.submit" @check-again="load({ force: true })" @pricing-retry="billing.retry" @usage-retry="billing.usageRetry" @interval="billing.interval" @plan="billing.choose" @manual-plan="billing.chooseManual" @requests="billing.requests" @manual-close="billing.closeManual" @manual-refresh="billing.refreshManual" @manual-select="billing.select" @manual-file="billing.selectFile" @manual-submit="billing.submitManual" @manual-cancel="billing.cancelManual" @manual-download="billing.download" @open-subscription="billing.openSubscription" @impact-close="billing.closeImpact"/>
</template>
