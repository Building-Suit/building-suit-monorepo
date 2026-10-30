<script setup lang="ts">
definePageMeta({layout:'clinical-recipient',middleware:'doctor-auth',pageTransition:false})
const {copy,view,reload,download,print}=useDoctorClinicalRelease()
useHead({meta:[{name:'robots',content:'noindex,nofollow'},{name:'referrer',content:'no-referrer'}]})
await reload()
</script>
<template><BsReleasedClinicalPage :view="view" :copy="copy" @retry="reload" @download="download" @print="print" /></template>
