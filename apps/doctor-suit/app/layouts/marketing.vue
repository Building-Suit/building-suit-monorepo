<script setup lang="ts">
import { doctorMarketingCopy } from '../utils/landingPresentation'
const { locale } = useI18n()
const auth = useDoctorAuth()
// A fresh public document has no client session projection yet. Resolve the
// Doctor session before choosing the returning-account workspace action.
onMounted(() => { if (auth.state.phase === 'checking') void auth.refresh() })
const brand = useDoctorBrand()
const content = computed(() => doctorMarketingCopy(locale.value==='ar'))
</script>
<template>
  <BsMarketingLayout :product="brand" :navigation="content.navigation" :legal-links="content.legalLinks" :labels="content.labels" :signed-in="auth.state.phase==='authenticated'" login-path="/sign-in" signup-path="/sign-up" dashboard-path="/workspace"><slot /></BsMarketingLayout>
</template>
