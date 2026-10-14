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

const pageCopy = computed(() => ({'ownerInvite.askAdmin':t('ownerInvite.askAdmin'),'ownerInvite.confirm':t('ownerInvite.confirm'),'ownerInvite.description':t('ownerInvite.description'),'ownerInvite.done':t('ownerInvite.done'),'ownerInvite.home':t('ownerInvite.home'),'ownerInvite.invalid':t('ownerInvite.invalid'),'ownerInvite.loading':t('ownerInvite.loading'),'ownerInvite.login':t('ownerInvite.login'),'ownerInvite.open':t('ownerInvite.open'),'ownerInvite.password':t('ownerInvite.password'),'ownerInvite.passwordError':t('ownerInvite.passwordError'),'ownerInvite.passwordTitle':t('ownerInvite.passwordTitle'),'ownerInvite.save':t('ownerInvite.save'),'ownerInvite.title':t('ownerInvite.title'),'ownerInvite.verified':t('ownerInvite.verified')}))
const pageView=computed(()=>({phase:phase.value,pending:pending.value,failed:failed.value}))
</script>

<template>
  <BsOwnerInvitationPage :copy="pageCopy" :view="pageView" v-model:password="password" v-model:confirmation="confirmation" @login="navigateTo('/auth/login')" @open="navigateTo('/dashboard')" @submit="savePassword" />
</template>
