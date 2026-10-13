<script setup lang="ts">
import { claimProvisionedOwner } from '../../utils/owner-invitation'

definePageMeta({ layout: false })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const client = useSupabaseClient()
const phase = ref<'loading' | 'ready' | 'error' | 'done'>('loading')
const password = ref(''), confirmation = ref(''), pending = ref(false), failed = ref(false)
useHead({ title: () => t('ownerInvite.title'), meta: [{ name: 'referrer', content: 'no-referrer' }] })
useResponseHeader('Cache-Control').value = 'private, no-store'
onMounted(async () => {
  const hash = typeof route.query.token_hash === 'string' && route.query.type === 'invite' ? route.query.token_hash : undefined
  // Strip the one-time credential before any subsequent page navigation or request.
  await router.replace({ path: '/auth/owner-invitation', query: {} })
  try { await claimProvisionedOwner(client as unknown as Parameters<typeof claimProvisionedOwner>[0], hash); phase.value = 'ready' }
  catch { phase.value = 'error' }
})
async function savePassword() {
  if (pending.value || phase.value !== 'ready') return
  failed.value = false
  if (password.value.length < 6 || password.value !== confirmation.value) { failed.value = true; return }
  const credential = password.value
  password.value = ''; confirmation.value = ''; pending.value = true
  try { const result = await client.auth.updateUser({ password: credential }); if (result.error) throw new Error(); phase.value = 'done' }
  catch { failed.value = true }
  finally { pending.value = false }
}
</script>

<template>
  <BsAuthLayout product-name="Shop Suit" :home-label="t('ownerInvite.home')" :title="t('ownerInvite.title')" :description="t('ownerInvite.description')">
    <template #logo="{ tone }"><BsProductLogo name="Shop Suit" asset-prefix="/brand/shop-suit" :tone="tone" /></template>
    <BsStateSurface v-if="phase === 'loading'" state="loading" :title="t('ownerInvite.loading')" />
    <BsStateSurface v-else-if="phase === 'error'" state="error" :title="t('ownerInvite.invalid')" :description="t('ownerInvite.askAdmin')" :action-label="t('ownerInvite.login')" @action="navigateTo('/auth/login')" />
    <BsStateSurface v-else-if="phase === 'done'" state="success" :title="t('ownerInvite.done')" :action-label="t('ownerInvite.open')" @action="navigateTo('/dashboard')" />
    <BsAuthForm v-else :title="t('ownerInvite.passwordTitle')" :description="t('ownerInvite.verified')" :error="failed ? t('ownerInvite.passwordError') : undefined" :pending="pending" :submit-label="t('ownerInvite.save')" @submit="savePassword">
      <BsField :label="t('ownerInvite.password')" for="owner-password" required>
        <BsInput id="owner-password" v-model="password" type="password" autocomplete="new-password" minlength="6" required />
      </BsField>
      <BsField :label="t('ownerInvite.confirm')" for="owner-confirm" required>
        <BsInput id="owner-confirm" v-model="confirmation" type="password" autocomplete="new-password" minlength="6" required />
      </BsField>
    </BsAuthForm>
  </BsAuthLayout>
</template>
