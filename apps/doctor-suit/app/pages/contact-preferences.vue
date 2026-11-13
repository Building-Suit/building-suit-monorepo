<script setup lang="ts">
definePageMeta({layout:'practice',middleware:'doctor-auth',pageTransition:false})
const{context,copy,view,patient,fields,editorOpen,historyOpen,selectPatient,loadPatients,reload,createContact,createGuardian,action,save,guardians,moreGuardians,changeContactPage,changeGuardianPage,historyPage}=useDoctorContactPreferencesPage()
useHead({meta:[{name:'robots',content:'noindex,nofollow'}]})
await context.refresh()
</script>
<template>
 <BsPatientContactPreferencesPage v-model:patient="patient" v-model:fields="fields" v-model:editor-open="editorOpen" v-model:history-open="historyOpen" :copy="copy" :view="view" @retry="reload" @patient="selectPatient" @patients="loadPatients" @create-contact="createContact" @create-guardian="createGuardian" @action="action" @save="save" @guardians="guardians" @more-guardians="moreGuardians" @contact-page="changeContactPage" @guardian-page="changeGuardianPage" @history-page="historyPage"/>
</template>
