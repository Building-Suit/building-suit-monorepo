<script setup lang="ts">
import { shopNavigation, shopSettingsNavigation, shopShellCopy } from '~/utils/shopNavigation'
import type { ShopBilling } from '~/types/billing'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { businessAreaForPath, businessModeSupportsPath } from '~/utils/businessMode'

const route = useRoute()
const supabase = useShopClient()
const nuxtApp = useNuxtApp()
const user = useSupabaseUser()
const { locale, t } = useI18n()
const { shops, current, currentId, activeLocations, currentLocationId, loading, loadError, loadShops, selectShop, selectLocation } = useShop()

const { isOwner, currentMembership } = useShop()
const isArabic = computed(() => locale.value === 'ar')
const billingRpc = useShopClient<ShopRpcDatabase>().schema('public')
const { data: sidebarSnapshot } = useShopQuery('shop-data:sidebar-subscription', async () => {
  if (!currentId.value || !isOwner.value || !currentMembership.value) return null
  const shopId = currentId.value, profileId = currentMembership.value.profile_id
  const { data, error } = await billingRpc.rpc('shop_billing_read', { p_shop_id: shopId })
  if (error) throw error
  return { shopId, profileId, subscription: (data as ShopBilling | null)?.subscription ?? null }
}, { scope: 'shop', enabled: () => Boolean(currentId.value && isOwner.value && currentMembership.value), watch: [currentId, isOwner, () => currentMembership.value?.profile_id], default: () => null })
const sidebarSubscription = computed(() => isOwner.value && sidebarSnapshot.value?.shopId === currentId.value && sidebarSnapshot.value?.profileId === currentMembership.value?.profile_id ? sidebarSnapshot.value.subscription : null)
const planStatus = computed(() => {
  const status = sidebarSubscription.value?.accessState
  const labels = isArabic.value ? { trialing: 'فترة التجربة', active: 'اشتراك نشط', read_only: 'للقراءة فقط', suspended: 'موقوف' } : { trialing: 'Free trial', active: 'Active subscription', read_only: 'Read only', suspended: 'Suspended' }
  return status ? labels[status] : ''
})
const planDetail = computed(() => {
  const subscription = sidebarSubscription.value
  if (!subscription) return ''
  const expiry = subscription.accessState === 'trialing' ? subscription.trialEndAt : subscription.periodEnd
  if (!expiry || !Number.isFinite(new Date(expiry).getTime())) return ''
  return expiry ? `${isArabic.value ? 'حتى' : 'Until'} ${new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium' }).format(new Date(expiry))}` : ''
})
const signingOut = ref(false)
const signOutError = ref('')
const showErrorDetails = import.meta.dev
const fullName = computed(() => {
  for (const value of [currentMembership.value?.full_name, user.value?.user_metadata.full_name, user.value?.user_metadata.name]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
})
const avatarUrl = computed(() => {
  const value = user.value?.user_metadata.avatar_url
  return typeof value === 'string' ? value : ''
})
const accountDetails = computed(() => {
  const selected = activeLocations.value.find(location => location.id === currentLocationId.value)
  return [
    ...(current.value ? [{ label: isArabic.value ? 'المتجر' : 'Shop', values: [current.value.name] }] : []),
    ...(selected ? [{ label: isArabic.value ? 'الفرع الحالي' : 'Current branch', values: [selected.name] }] : []),
    { label: `${isArabic.value ? 'الفروع' : 'Branches'} (${activeLocations.value.length})`, values: activeLocations.value.map(location => location.name) },
  ]
})
const settingsLinks = computed(() => shopSettingsNavigation(isArabic.value, isOwner.value))
const shopOptions = computed(() => shops.value.map(shop => ({ id: shop.id, label: shop.name })))
const locationOptions = computed(() => activeLocations.value.map(location => ({ id: location.id, label: location.name })))

const copy = computed(() => shopShellCopy(isArabic.value))
const groups = computed(() => shopNavigation(current.value?.business_mode ?? 'mixed', locale.value, t))

await loadShops()

watch(
  [() => current.value?.business_mode, () => route.path],
  ([mode, path]) => {
    if (!mode || businessModeSupportsPath(mode, path)) return
    void navigateTo({ path: '/dashboard', query: { modeDisabled: businessAreaForPath(path) ?? undefined } })
  },
)

async function logout() {
  if (signingOut.value) return
  signingOut.value = true
  signOutError.value = ''
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    await nuxtApp.runWithContext(() => navigateTo('/auth/login'))
  } catch { signOutError.value = copy.value.signOutFailed }
  finally { signingOut.value = false }
}

const shellHeaderScopes = computed(() => [
  ...(shops.value.length ? [{ key: 'workspace', value: currentId.value, label: copy.value.shop, options: shopOptions.value, visibility: 'desktop' as const }] : []),
  ...(activeLocations.value.length ? [{ key: 'location', value: currentLocationId.value, label: copy.value.location, options: locationOptions.value }] : []),
])
function selectShellScope(key: string, value: string | null) { if (!value) return; if (key === 'workspace') return selectShop(value); if (key === 'location') return selectLocation(value) }
</script>
<template>
  <BsWorkspaceShell variant="shop" :sidebar-plan="sidebarSubscription ? { name: sidebarSubscription.planName, status: planStatus, detail: planDetail, actionLabel: copy.billing, to: '/billing' } : undefined" home-path="/dashboard" product-name="Shop Suit" :groups="groups" :settings-links="settingsLinks" :mobile-links="[...(groups[0]?.links.slice(0, 3) ?? []), { to: '/dashboard', label: copy.reports, icon: 'dashboard' }]" :labels="{ close: copy.closeMenu, open: copy.openMenu, collapse: copy.collapseMenu, navigation: copy.shop, dashboard: copy.dashboard }" :logo="{ kind: 'product', assetPrefix: '/brand/shop-suit' }" :context-scope="shops.length ? { key: 'workspace', value: currentId, label: copy.shop, options: shopOptions } : undefined" :header-scopes="shellHeaderScopes" :account="{ actions: settingsLinks, name: fullName, email: user?.email || currentMembership?.email || undefined, avatarUrl, details: accountDetails, label: copy.account, signOut: copy.logout, pending: signingOut, error: signOutError }" :state="{ loading, error: Boolean(loadError), title: copy.loadFailed, description: showErrorDetails ? loadError || undefined : undefined, retry: copy.retry }" feedback @scope="selectShellScope" @retry="loadShops({ force: true })" @sign-out="logout"><slot /></BsWorkspaceShell>
</template>
