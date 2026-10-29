<script setup lang="ts">
defineOptions({name:'DoctorNativeAccountPage'})
definePageMeta({layout:false})
const{auth,product,availability:connection,error,t}=useDoctorNativeAuthPresentation()
const availability=computed(()=>connection.value??(auth.state.phase==='ready'?undefined:{state:auth.state.phase==='loading'?'loading' as const:'permission' as const,title:t('phase.signed-out.title'),description:t('phase.signed-out.body')}))
watch(()=>auth.state.phase,phase=>{if(phase==='signed-out'||phase==='error')void navigateTo('/sign-in',{replace:true})})
onMounted(()=>{if(auth.state.phase==='signed-out'||auth.state.phase==='error')void navigateTo('/sign-in',{replace:true})})
async function signOut(){await auth.signOut();await navigateTo('/sign-in',{replace:true})}
</script>
<template><BsAccountSessionPage :product="product" :title="t('auth.account')" :description="t('destination.account')" :status="t('auth.signedIn')" :status-description="t('auth.accountDescription')" :sign-out="t('auth.signOut')" :availability="availability" :pending="auth.state.phase==='loading'" :error="error" :primary-action="{label:t('nav.workspace'),to:'/workspace',description:t('auth.accountDescription')}" @sign-out="signOut"/></template>
