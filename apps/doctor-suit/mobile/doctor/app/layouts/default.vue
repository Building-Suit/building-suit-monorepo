<script setup lang="ts">
import {nativeContextId} from '../utils/nativeContext'
const {t}=useI18n(),ui=useUiCopy(),context=useDoctorNativeContext(),{auth}=useDoctorNativeAuth(),confirmation=useConfirmation()
const scope=computed(()=>context.state.current)
const scopeText=computed(()=>scope.value?`${scope.value.doctorName} · ${scope.value.practiceName} · ${scope.value.locationName}`:t('context.choose'))
const scopes=computed(()=>auth.identity()?[{key:'location',value:scope.value?nativeContextId(scope.value.context):null,label:t('context.choose'),placeholder:t('context.choose'),visibility:'always' as const,disabled:['loading','switching'].includes(context.state.phase),options:context.state.options.map(option=>({id:nativeContextId(option.context),label:`${option.doctorName} · ${option.practiceName} · ${option.locationName}`}))}]:[])
async function select(_key:string,id:string|null){
 if(!id)return
 await context.choose(id)
 if(context.state.pending){
  const pending=context.state.pending
  const accepted=await confirmation.ask({title:t('context.discardTitle'),message:t('context.discardBody'),confirmLabel:t('context.discard'),cancelLabel:ui('cancel'),tone:'danger'})
  if(context.state.pending!==pending)return
  if(accepted)await context.discardAndChoose();else context.cancel()
 }
}

const groups=computed(()=>[{key:'doctor',label:t('product.name'),links:[{to:'/workspace',label:t('nav.workspace'),icon:'dashboard'},{to:'/schedule',label:t('nav.schedule'),icon:'calendar'},{to:'/account',label:t('nav.account'),icon:'user'}]}])
const labels=computed(()=>({open:ui('open'),close:ui('close'),navigation:ui('navigation'),dashboard:t('nav.workspace')}))
</script>
<template><BsWorkspaceShell home-path="/workspace" :product-name="t('product.name')" :groups="groups" :context="scopeText" :header-scopes="scopes" :labels="labels" :mobile-links="groups[0]!.links" :logo="{kind:'product',assetPrefix:'doctor-suit',initials:'D'}" @scope="select"><slot/></BsWorkspaceShell></template>
