<script setup lang="ts">
const brand = useDoctorBrand()
const auth = useDoctorAuth()
const { locale } = useI18n()
const ui = useUiCopy()
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
const ar = computed(() => locale.value === 'ar')
const notice = computed(() => ({ title: ar.value ? 'وصول إلى نسخة اصطناعية محددة' : 'Specific synthetic version access', description: ar.value ? 'تُعرض فقط النسخة التي أُتيحت لهذا الحساب صراحةً. لا تمنح الإتاحة عضوية في الممارسة.' : 'Only the version explicitly released to this account is shown. Access does not grant practice membership.' }))
const account = computed(() => ({ label: ar.value ? 'الحساب' : 'Account', signOut: ar.value ? 'تسجيل الخروج' : 'Sign out', pending: !hydrated.value || auth.state.pending }))
const labels = computed(() => ({ open: ui('open'), close: ui('close'), navigation: ui('navigation'), dashboard: 'Doctor Suit' }))
async function signOut() { await auth.signOut(); await navigateTo('/sign-in') }
</script>
<template><BsWorkspaceShell home-path="/" product-name="Doctor Suit" :groups="[]" :labels="labels" :scope-notice="notice" :account="account" :logo="{ kind: 'product', assetPrefix: brand.assetPrefix }" @sign-out="signOut"><slot /></BsWorkspaceShell></template>
