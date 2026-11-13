<script setup lang="ts">
definePageMeta({ layout: 'practice', middleware: 'doctor-auth', pageTransition: false })
await useDoctorContext().refresh()
const { controller, copy, view, form, advance, refresh } = await useDoctorPracticeMoney()
</script>
<template>
 <BsPracticeMoneyPage v-model:form="form" :copy="copy" :view="view" @refresh="refresh" @retry="controller.retry()" @collect="controller.open()" @refund="controller.open" @advance="advance" @save="controller.save()" @visible="controller.visible" @page="controller.page" />
</template>
