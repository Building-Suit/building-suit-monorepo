<script setup lang="ts">
import{doctorMobileDestination}from'../utils/mobileShell'
import{createEmailStepController,emailStepState,emailStepDelay,normalizedAuthEmail}from'@building-suit/ux'
definePageMeta({layout:false})
const{auth,product,availability,error,t}=useDoctorNativeAuthPresentation()
const route=useRoute(),destination=computed(()=>doctorMobileDestination(typeof route.query.next==='string'?route.query.next:'/account')??'/account')
const email=ref(''),password=ref(''),hydrated=ref(false),emailState=reactive(emailStepState())
let disposed=false
const emailStep=createEmailStepController(emailState,()=>email.value,(address,signal)=>auth.checkEmail(address,signal),emailStepDelay)
watch(email,()=>emailStep.reset())
watch(()=>auth.state.revision,()=>{email.value='';password.value='';emailStep.reset()})
const emailError=computed(()=>emailState.error?t(emailState.error==='rejected'?'auth.unknownEmail':'auth.emailUnavailable'):null)
onMounted(()=>{hydrated.value=true;if(auth.state.phase==='ready')void navigateTo(destination.value,{replace:true})})
async function submit(){
 if(auth.state.phase==='loading'||!emailState.approved||emailState.email!==normalizedAuthEmail(email.value))return
 const address=email.value,secret=password.value;password.value=''
 if(await auth.signIn(address,secret)&&!disposed)await navigateTo(destination.value,{replace:true})
}
onBeforeUnmount(()=>{disposed=true;email.value='';password.value='';emailStep.reset()})
</script>
<template><BsSignInPage v-model:email="email" v-model:password="password" :product="product" :availability="availability" :copy="{title:t('auth.signIn'),description:t('auth.description'),email:t('auth.email'),password:t('auth.password'),submit:t('auth.signIn'),pending:t('auth.pending'),continue:t('auth.continue'),back:t('auth.back'),checkingEmail:t('auth.checkingEmail')}" :pending="auth.state.phase==='loading'" :hydrated="hydrated" :error="error" email-step-required :email-step-pending="emailState.pending" :email-step-approved="emailState.approved" :email-step-error="emailError" :forgot="{to:'/recover',label:t('auth.recover')}" @validate-email="emailStep.check()" @edit-email="emailStep.reset()" @submit="submit"/></template>
