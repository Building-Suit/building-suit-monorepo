<script setup lang="ts">
defineOptions({name:'DoctorNativeRecoverPage'})
definePageMeta({layout:'auth'})
const{auth,availability,error,t}=useDoctorNativeAuthPresentation()
const email=ref(''),password=ref(''),confirmation=ref(''),code=ref(''),mode=ref<'request'|'reset'>('request'),complete=ref(false),validation=ref(false)
let disposed=false
watch(()=>auth.state.revision,()=>{email.value='';password.value='';confirmation.value='';code.value=''})
async function submit(){
 if(auth.state.phase==='loading')return
 validation.value=mode.value==='reset'&&(password.value.length<12||password.value!==confirmation.value||!/^\d{6}$/.test(code.value))
 if(validation.value)return
 const address=email.value,secret=password.value,otp=code.value;password.value='';confirmation.value='';code.value=''
 if(mode.value==='request'){
  if(await auth.recover(address)&&!disposed){email.value=address;mode.value='reset'}
 }else complete.value=await auth.completeRecovery(address,otp,secret)&&!disposed
}
function requestAgain(){auth.lock();mode.value='request';complete.value=false;validation.value=false}
onBeforeUnmount(()=>{disposed=true;email.value='';password.value='';confirmation.value='';code.value=''})
</script>
<template><BsPasswordRecoveryPage v-model:email="email" v-model:password="password" v-model:confirmation="confirmation" v-model:code="code" :mode="mode" :availability="availability" :copy="{eyebrow:'',title:t('auth.recover'),description:t('auth.recoveryDescription'),submit:t(mode==='request'?'auth.requestCode':'auth.reset'),pending:t('auth.pending'),success:t('auth.changed'),successAction:t('auth.account'),email:t('auth.email'),password:t('auth.password'),confirmation:t('auth.confirmation'),reveal:t('auth.reveal'),back:t('auth.signIn')}" :recovery-code="mode==='reset'?{label:t('auth.code'),emailLabel:t('auth.email'),length:6,requestAgainLabel:t('auth.requestAgain')}:undefined" :pending="auth.state.phase==='loading'" :complete="complete" valid :error="validation?t('auth.invalid'):error" back-to="/sign-in" @submit="submit" @request-again="requestAgain" @success-action="navigateTo('/account',{replace:true})"/></template>
