<script setup lang="ts">
const route=useRoute(),shell=useDoctorMobile(),{t}=useI18n()
watch(()=>route.path,path=>{void shell.navigate(path)},{immediate:true})
const copy=computed(()=>({title:t('product.name'),description:t(`destination.${shell.state.route.slice(1)}`),notice:t('notice'),retry:t('retry')}))
const view=computed(()=>({state:({loading:'loading','signed-out':'empty',denied:'denied',offline:'info',error:'error',ready:'success'} as const)[shell.state.phase],title:t(`phase.${shell.state.phase}.title`),description:t(`phase.${shell.state.phase}.body`),retry:!['loading','signed-out'].includes(shell.state.phase),context:shell.state.phase==='ready'&&shell.state.context?t('verifiedContext'):null}))
</script>
<template><BsMobileAccessPage :copy="copy" :view="view" @retry="shell.retry()"/></template>
