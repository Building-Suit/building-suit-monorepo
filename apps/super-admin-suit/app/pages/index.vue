<script setup lang="ts">
definePageMeta({ layout: false })
const { t } = useI18n()
const { ready, state, pending, actionError, recheck, signIn, signOut } = useAdminSession()
await ready
const email = ref('')
const password = ref('')
const accountModules = ref<{ bindingId: string; label: Record<string, string> }[]>([])
const moduleError = ref(false)
const { locale } = useI18n()
const requestFetch = useRequestFetch()
let moduleGeneration = 0
async function loadAccountModules() {
  const epoch = ++moduleGeneration
  accountModules.value = []; moduleError.value = false
  if (state.value !== 'success') return
  try {
    const result = await requestFetch<{ modules: typeof accountModules.value }>('/api/accounts/context')
    if (epoch === moduleGeneration && state.value === 'success') accountModules.value = result.modules
  } catch { if (epoch === moduleGeneration) moduleError.value = true }
}
watch(state, loadAccountModules)
onMounted(loadAccountModules)
onScopeDispose(() => { moduleGeneration++; accountModules.value = [] })
useHead({ title: () => t('product.name') })
async function submit() {
  const credential = password.value
  password.value = ''
  await signIn(email.value.trim(), credential)
}

const pageCopy = computed(() => ({'accounts.close':t('accounts.close'),'accounts.open':t('accounts.open'),'accounts.title':t('accounts.title'),'accounts.unavailable':t('accounts.unavailable'),'auth.actionError':t('auth.actionError'),'auth.authorized':t('auth.authorized'),'auth.deniedDescription':t('auth.deniedDescription'),'auth.description':t('auth.description'),'auth.email':t('auth.email'),'auth.empty':t('auth.empty'),'auth.password':t('auth.password'),'auth.pending':t('auth.pending'),'auth.retry':t('auth.retry'),'auth.signIn':t('auth.signIn'),'auth.signInError':t('auth.signInError'),'auth.signOut':t('auth.signOut'),'description':t('description'),'product.name':t('product.name'),'welcome':t('welcome')}))
const pageView=computed(()=>({state:state.value,pending:pending.value,actionError:!!actionError.value,moduleError:moduleError.value,stateTitle:t(`auth.${state.value}`),modules:accountModules.value.map(item=>({id:item.bindingId,label:item.label[locale.value]||item.label.en||item.label.ar||''}))}))
</script>

<template>
  <BsAccountAdminHomePage :copy="pageCopy" :view="pageView" v-model:email="email" v-model:password="password" @module="id=>navigateTo({path:'/accounts',query:{bindingId:id}})" @sign-out="signOut" @sign-in="submit" @retry="recheck" />
</template>
