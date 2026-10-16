<script setup lang="ts">
definePageMeta({layout:false})
const booking=usePublicBooking()
await booking.initializeLocale()
</script>
<template><BsPublicAppointmentBookingPage v-model:form="booking.form.value" v-model:verify-open="booking.verifyOpen.value" v-model:cancel-open="booking.cancelOpen.value" :view="booking.view.value" @reminder="booking.reminder" @verify="booking.verify" @logout="booking.logout" @retry="booking.refresh" @slots="booking.loadSlots" @create="booking.create" @reschedule="booking.reschedule" @save-reschedule="booking.saveReschedule" @request-cancel="booking.requestCancel" @cancel="booking.cancel" @mode="booking.setMode" @page="booking.setPage"/></template>
