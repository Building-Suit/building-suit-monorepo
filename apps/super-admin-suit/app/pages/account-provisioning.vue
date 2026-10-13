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
</script>

<template>
  <BsAppShell :product-name="t('product.name')" :groups="[]" home-path="/" :labels="{open:t('accounts.open'),close:t('accounts.close'),navigation:t('provision.title'),dashboard:t('provision.title')}">
    <template #logo><BsProductLogo :name="t('product.name')" /></template><template #header><BsSettingsMenu /></template>
    <BsContentSection :title="t('provision.title')" :description="t('provision.description')" padding="lg">
      <BsStack gap="lg">
        <BsButton @click="navigateTo({path:'/accounts',query:{bindingId}})">{{ t('provision.existing') }}</BsButton>
        <BsStateSurface v-if="state!=='success'" state="permission" :title="t('auth.denied')" />
        <BsStateSurface v-else-if="loading" state="loading" :title="t('accounts.loading')" />
        <BsStateSurface v-else-if="failed" state="error" :title="t('accounts.unavailable')" :action-label="t('auth.retry')" @action="initialize" />
        <BsStateSurface v-else-if="!configured" state="empty" :title="t('provision.unconfigured')" />
        <BsStack v-else gap="lg">
          <BsAlert v-if="projection" :tone="projection.phase==='active'?'success':projection.phase==='conflict'?'error':'warning'" :title="t(`provision.phases.${projection.phase}`)" :description="projection.phase==='active'?t('accounts.noPayment'):t('provision.noActivation')" />
          <BsDescriptionList v-if="projection" :columns="2">
            <BsDescriptionItem :term="t('provision.email')">{{ projection.email }}</BsDescriptionItem>
            <BsDescriptionItem :term="t('provision.invitation')">{{ t(`provision.invites.${projection.invitationState}`) }}</BsDescriptionItem>
            <BsDescriptionItem :term="t('provision.verification')">{{ projection.ownerVerified?t('provision.verified'):t('provision.awaitingOwner') }}</BsDescriptionItem>
            <BsDescriptionItem :term="t('accounts.start')">{{ date(projection.subscription?.periodStart) }}</BsDescriptionItem>
            <BsDescriptionItem :term="t('accounts.end')">{{ date(projection.subscription?.periodEnd) }}</BsDescriptionItem>
            <BsDescriptionItem :term="t('provision.record')">{{ projection.provisioningId }}</BsDescriptionItem>
          </BsDescriptionList>
          <BsAlert v-if="uncertain" tone="warning" :title="t('provision.unknown')" :description="t('accounts.keepRequest')" />
          <BsButton v-if="projection" @click="refreshStatus()">{{ t('provision.refresh') }}</BsButton>
          <BsButton v-if="attempt" @click="resend=attempt.kind==='resend';action.open('edit')">{{ t('accounts.retrySame') }}</BsButton>
          <BsButton v-if="projection?.phase==='active'&&!projection.ownerVerified&&attempt?.kind!=='resend'" :disabled="pending" @click="openResend">{{ t('provision.resend') }}</BsButton>
          <BsForm v-if="!projection||projection.phase!=='active'" :disabled="!!attempt||pending||visible||projection?.phase==='conflict'" @submit="openCreate">
            <BsField :label="t('provision.email')" for="provision-email" required><BsInput id="provision-email" v-model="form.email" type="email" autocomplete="email" maxlength="254" required /></BsField>
            <BsField :label="t('provision.ownerName')" for="provision-owner" required><BsInput id="provision-owner" v-model="form.displayName" minlength="2" maxlength="120" required /></BsField>
            <BsField :label="t('provision.shopName')" for="provision-shop" required><BsInput id="provision-shop" v-model="form.shopName" minlength="2" maxlength="120" required /></BsField>
            <BsField :label="t('provision.location')" for="provision-location" required><BsInput id="provision-location" v-model="form.mainLocationName" minlength="2" maxlength="120" required /></BsField>
            <BsField :label="t('provision.mode')" for="provision-mode" required><BsSelect id="provision-mode" v-model="form.businessMode" :label="t('provision.mode')" :options="modeOptions" option-label="label" option-value="value" required /></BsField>
            <BsField :label="t('accounts.plan')" for="provision-plan" required><BsSelect id="provision-plan" v-model="form.planId" :label="t('accounts.plan')" :options="planOptions" option-label="label" option-value="value" required /></BsField>
            <BsField :label="t('accounts.reason')" for="provision-reason" required><BsTextarea id="provision-reason" v-model="form.reason" minlength="8" maxlength="1000" required /></BsField>
            <BsFormActions><BsButton type="submit" variant="primary" :disabled="!valid">{{ t('provision.create') }}</BsButton></BsFormActions>
          </BsForm>
        </BsStack>
      </BsStack>
    </BsContentSection>
    <BsRecordActionDialog v-model:visible="visible" :title="resend?t('provision.resend'):t('provision.confirm')" :dirty="dirty" :pending="pending" :error="error" :submit-disabled="!valid" :submit-label="attempt&&(!resend||attempt.kind==='resend')?t('accounts.retrySame'):t('provision.confirm')" @submit="submit">
      <BsAlert tone="warning" :title="resend?t('provision.resendWarning'):t('provision.startsNow')" :description="resend?t('provision.resendConsequences'):t('provision.consequences')" />
      <BsDescriptionList><BsDescriptionItem :term="t('provision.email')">{{ projection?.email||form.email }}</BsDescriptionItem><BsDescriptionItem :term="t('accounts.request')">{{ attempt?.input.requestId||t('accounts.none') }}</BsDescriptionItem></BsDescriptionList>
      <BsField v-if="resend" :label="t('accounts.reason')" for="resend-reason" required><BsTextarea id="resend-reason" v-model="resendReason" minlength="8" maxlength="1000" :disabled="attempt?.kind==='resend'" required /></BsField>
      <BsCheckbox v-if="resend" v-model="acknowledged" :label="t('provision.acknowledge')" :disabled="attempt?.kind==='resend'" required />
    </BsRecordActionDialog>
  </BsAppShell>
</template>
