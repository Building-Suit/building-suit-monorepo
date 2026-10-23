<script setup lang="ts">
const {t}=useI18n(),ui=useUiCopy()
const groups=computed(()=>[{key:'doctor',label:t('product.name'),links:[{to:'/workspace',label:t('nav.workspace'),icon:'dashboard'},{to:'/schedule',label:t('nav.schedule'),icon:'calendar'},{to:'/account',label:t('nav.account'),icon:'user'}]}])
const labels=computed(()=>({open:ui('open'),close:ui('close'),navigation:ui('navigation'),dashboard:t('nav.workspace')}))
</script>
<template><BsWorkspaceShell home-path="/workspace" :product-name="t('product.name')" :groups="groups" :labels="labels" :mobile-links="groups[0]!.links" :logo="{kind:'product',assetPrefix:'doctor-suit',initials:'D'}"><slot/></BsWorkspaceShell></template>
