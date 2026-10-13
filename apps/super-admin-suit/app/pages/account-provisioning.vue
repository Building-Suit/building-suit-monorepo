<script setup lang="ts">
import type { AccountOutcome, AccountScope } from '../types/account-workflow'
import type { ProvisionAttempt, ProvisionInput, ProvisionPlan, ProvisionProjection } from '../types/account-provisioning'
import { provisionKey, restoreProvision } from '../utils/provision-attempt'

definePageMeta({layout:false})
const { t,locale }=useI18n()
const route=useRoute()
const { ready,state }=useAdminSession()
await ready
const bindingId=computed(()=>typeof route.query.bindingId==='string'?route.query.bindingId:'')
const scope=computed<AccountScope|null>(()=>ready.data.value&&bindingId.value?{...ready.data.value,bindingId:bindingId.value}:null)
const fetchRequest=useRequestFetch()
const form=reactive({email:'',displayName:'',shopName:'',mainLocationName:'',businessMode:null as string|null,planId:null as string|null,reason:''})
const plans=ref<ProvisionPlan[]>([]), modes=ref<string[]>([]), configured=ref(false), loading=ref(false), failed=ref(false)
const attempt=ref<ProvisionAttempt|null>(null), projection=ref<ProvisionProjection|null>(null), uncertain=ref(false)
const resend=ref(false), acknowledged=ref(false), resendReason=ref('')
const action=useRecordAction(()=>({form,resend:resend.value,acknowledged:acknowledged.value,resendReason:resendReason.value}))
const {visible,pending,dirty,error}=action
const selected=computed(()=>plans.value.find(plan=>plan.id===form.planId))
const planOptions=computed(()=>plans.value.map(plan=>({value:plan.id,label:`${plan.name} · ${t(`accounts.intervals.${plan.billingInterval}`)}`})))
const modeOptions=computed(()=>modes.value.map(mode=>({value:mode,label:t(`provision.modes.${mode}`)})))
const valid=computed(()=>{
  if(resend.value&&attempt.value?.kind==='create')return acknowledged.value&&resendReason.value.trim().length>=8
  if(attempt.value)return true
  return resend.value?acknowledged.value&&resendReason.value.trim().length>=8:
    !!selected.value&&!!form.businessMode&&!!form.email.trim()&&[form.displayName,form.shopName,form.mainLocationName].every(value=>value.trim().length>=2)&&form.reason.trim().length>=8
})
let generation=0
let loadedScope=''
function date(value:string|undefined){return value?new Date(value).toLocaleString(locale.value):t('accounts.none')}
async function initialize(){
  const epoch=++generation
  configured.value=false; projection.value=null; attempt.value=null; uncertain.value=false; plans.value=[]; modes.value=[]; visible.value=false
  if(state.value!=='success'||!scope.value){
    if(state.value==='signed-out'||state.value==='denied'){loadedScope='';Object.assign(form,{email:'',displayName:'',shopName:'',mainLocationName:'',businessMode:null,planId:null,reason:''})}
    return
  }
  const key=provisionKey(scope.value)
  if(loadedScope!==key){Object.assign(form,{email:'',displayName:'',shopName:'',mainLocationName:'',businessMode:null,planId:null,reason:''});loadedScope=key}
  failed.value=false; loading.value=true
  try{
    const context=await fetchRequest<{modules:{bindingId:string;provisioningAvailable:boolean}[]}>('/api/accounts/context')
    if(epoch!==generation||!scope.value||provisionKey(scope.value)!==key)return
    configured.value=context.modules.some(module=>module.bindingId===bindingId.value&&module.provisioningAvailable)
    if(!configured.value)return
    const catalog=await fetchRequest<AccountOutcome>('/api/accounts/provisioning',{query:{bindingId:bindingId.value}})
    if(epoch!==generation||!scope.value||provisionKey(scope.value)!==key)return
    if(catalog.state!=='success')throw new Error()
    const data=catalog.data as {plans:ProvisionPlan[];businessModes:string[]}
    plans.value=data.plans; modes.value=data.businessModes
    if(import.meta.client){
      attempt.value=restoreProvision(sessionStorage.getItem(key),scope.value)
      const previous=sessionStorage.getItem(`${key}:status`)
      if(previous)await refreshStatus(previous)
      if(attempt.value){
        uncertain.value=true; resend.value=attempt.value.kind==='resend'
        if(attempt.value.kind==='create'){
          const input=attempt.value.input
          Object.assign(form,{email:input.email,displayName:input.displayName,shopName:input.shopName,mainLocationName:input.mainLocationName,businessMode:input.businessMode,planId:input.planId,reason:input.reason})
        }
        else{acknowledged.value=true;resendReason.value=attempt.value.input.reason}
        action.open('edit')
      }
    }
  }catch{if(epoch===generation)failed.value=true}
  finally{if(epoch===generation)loading.value=false}
}
async function refreshStatus(id=projection.value?.provisioningId){
  if(!id||!scope.value)return
  const key=provisionKey(scope.value)
  try{
    const result=await fetchRequest<AccountOutcome>('/api/accounts/provisioning',{query:{bindingId:bindingId.value,provisioningId:id}})
    if(!scope.value||provisionKey(scope.value)!==key)return
    if(result.state==='success')projection.value=result.data as ProvisionProjection
    else uncertain.value=true
  }catch{uncertain.value=true}
}
function openCreate(){resend.value=false;action.open('create')}
function openResend(){
  // This is a new acknowledged send, not a replay of the uncertain email call.
  resend.value=true;acknowledged.value=false;resendReason.value='';action.open('edit')
}
async function submit(){
  if(!valid.value||!scope.value||pending.value)return
  const key=provisionKey(scope.value)
  const replacement=resend.value&&attempt.value?.kind==='create'
  if(!attempt.value||replacement){
    let next:ProvisionAttempt
    if(resend.value){
      if(!projection.value||!acknowledged.value)return
      next={kind:'resend',input:{bindingId:bindingId.value,provisioningId:projection.value.provisioningId,requestId:crypto.randomUUID(),correlationId:crypto.randomUUID(),reason:resendReason.value.trim(),acknowledgeUncertainSend:true}}
    }else{
      const input:ProvisionInput={bindingId:bindingId.value,email:form.email.trim().toLowerCase(),displayName:form.displayName.trim(),shopName:form.shopName.trim(),mainLocationName:form.mainLocationName.trim(),businessMode:form.businessMode!,planId:selected.value!.id,catalogTermsId:selected.value!.catalogTermsId,requestId:crypto.randomUUID(),correlationId:crypto.randomUUID(),reason:form.reason.trim()}
      next={kind:'create',input}
    }
    try{sessionStorage.setItem(key,JSON.stringify(next));attempt.value=next}
    catch{action.fail(t('accounts.storageUnavailable'));return}
  }
  const saved=attempt.value!
  pending.value=true;error.value=null
  try{
    const result=await fetchRequest<AccountOutcome>(saved.kind==='create'?'/api/accounts/provision':'/api/accounts/invitation',{method:'POST',body:saved.input})
    if(!scope.value||provisionKey(scope.value)!==key)return
    if(result.state==='outcome_unknown'){uncertain.value=true;action.fail(t('provision.unknown'));return}
    if(result.state==='target_rejected'){sessionStorage.removeItem(key);attempt.value=null;action.fail(t('accounts.rejected'));return}
    projection.value=result.data as ProvisionProjection
    sessionStorage.setItem(`${key}:status`,projection.value.provisioningId)
    uncertain.value=false
    if(projection.value.phase==='conflict'||(projection.value.phase==='active'&&['sent','claimed'].includes(projection.value.invitationState))){
      sessionStorage.removeItem(key);attempt.value=null;action.complete()
    }else{action.fail(t(`provision.phases.${projection.value.phase}`));action.complete()}
  }catch{uncertain.value=true;action.fail(t('provision.unknown'))}
  finally{pending.value=false}
}
watch(()=>[state.value,bindingId.value,ready.data.value?.userId,ready.data.value?.authorityEnvironmentId],initialize)
onMounted(initialize)
onScopeDispose(()=>{generation++;projection.value=null;attempt.value=null;plans.value=[]})
useHead({title:()=>t('provision.title')})

const pageCopy = computed(() => ({'accounts.close':t('accounts.close'),'accounts.end':t('accounts.end'),'accounts.keepRequest':t('accounts.keepRequest'),'accounts.loading':t('accounts.loading'),'accounts.noPayment':t('accounts.noPayment'),'accounts.none':t('accounts.none'),'accounts.open':t('accounts.open'),'accounts.plan':t('accounts.plan'),'accounts.reason':t('accounts.reason'),'accounts.request':t('accounts.request'),'accounts.retrySame':t('accounts.retrySame'),'accounts.start':t('accounts.start'),'accounts.unavailable':t('accounts.unavailable'),'auth.denied':t('auth.denied'),'auth.retry':t('auth.retry'),'product.name':t('product.name'),'provision.acknowledge':t('provision.acknowledge'),'provision.awaitingOwner':t('provision.awaitingOwner'),'provision.confirm':t('provision.confirm'),'provision.consequences':t('provision.consequences'),'provision.create':t('provision.create'),'provision.description':t('provision.description'),'provision.email':t('provision.email'),'provision.existing':t('provision.existing'),'provision.invitation':t('provision.invitation'),'provision.location':t('provision.location'),'provision.mode':t('provision.mode'),'provision.noActivation':t('provision.noActivation'),'provision.ownerName':t('provision.ownerName'),'provision.record':t('provision.record'),'provision.refresh':t('provision.refresh'),'provision.resend':t('provision.resend'),'provision.resendConsequences':t('provision.resendConsequences'),'provision.resendWarning':t('provision.resendWarning'),'provision.shopName':t('provision.shopName'),'provision.startsNow':t('provision.startsNow'),'provision.title':t('provision.title'),'provision.unconfigured':t('provision.unconfigured'),'provision.unknown':t('provision.unknown'),'provision.verification':t('provision.verification'),'provision.verified':t('provision.verified')}))
const pageForm=computed({get:()=>({...form}),set:value=>Object.assign(form,value)})
const pageView=computed(()=>({state:state.value,loading:loading.value,failed:failed.value,configured:configured.value,uncertain:uncertain.value,
 projection:projection.value?{email:projection.value.email,provisioningId:projection.value.provisioningId,ownerVerified:projection.value.ownerVerified,phase:projection.value.phase,phaseLabel:t(`provision.phases.${projection.value.phase}`),invitationLabel:t(`provision.invites.${projection.value.invitationState}`),startLabel:date(projection.value.subscription?.periodStart),endLabel:date(projection.value.subscription?.periodEnd)}:null,
 attempt:attempt.value?{kind:attempt.value.kind,input:{requestId:attempt.value.input.requestId}}:null,resend:resend.value,valid:valid.value,dirty:dirty.value,pending:pending.value,error:error.value,planOptions:planOptions.value,modeOptions:modeOptions.value,
}))
</script>

<template>
  <BsAccountProvisioningPage :copy="pageCopy" :view="pageView" v-model:form="pageForm" v-model:visible="visible" v-model:acknowledged="acknowledged" v-model:resend-reason="resendReason" @existing="navigateTo({path:'/accounts',query:{bindingId}})" @retry="initialize" @refresh="refreshStatus()" @retry-attempt="resend=attempt?.kind==='resend';action.open('edit')" @resend="openResend" @create="openCreate" @submit="submit" />
</template>
