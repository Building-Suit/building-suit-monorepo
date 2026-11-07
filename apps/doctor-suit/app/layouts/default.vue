<script setup lang="ts">
const brand = useDoctorBrand()
const { t } = useI18n()
const ui = useUiCopy()
const labels = computed(() => ({ open: ui('open'), close: ui('close'), navigation: ui('navigation'), dashboard: t('welcome') }))
const { locale } = useI18n()
const auth = useDoctorAuth()
const context = computed(() => auth.state.identity ? (locale.value === 'ar' ? 'معاينة عامة · لا يُستخدم سياق الحساب أو الممارسة هنا' : 'Public preview · account and practice context are not used here') : locale.value === 'ar' ? 'معاينة تجريبية · لا يوجد حساب أو ممارسة أو موقع نشط' : 'Synthetic preview · no active account, practice or location')
const readOnly = computed(() => ({ title: locale.value === 'ar' ? 'معاينة ببيانات تجريبية فقط' : 'Synthetic preview only', description: context.value, actionTo: '/' }))
</script>
<template><BsWorkspaceShell home-path="/" :product-name="t('product.name')" :groups="[]" :labels="labels" :read-only="readOnly" :logo="{ kind: 'product', assetPrefix: brand.assetPrefix }"><slot/></BsWorkspaceShell></template>
