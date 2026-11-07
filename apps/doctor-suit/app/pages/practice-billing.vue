<script setup lang="ts">
definePageMeta({ layout: 'practice', middleware: 'doctor-auth', pageTransition: false })
const context = useDoctorContext()
await context.refresh()
const { controller, copy, view, priceFields, chargeFields, locationId } = await useDoctorPracticeBilling()
</script>
<template>
 <BsPracticeBillingPage v-model:price-fields="priceFields" v-model:charge-fields="chargeFields" v-model:location-id="locationId" :copy="copy" :view="view" @retry="controller.refresh()" @retry-operation="controller.retry()" @create-price="controller.startPrice()" @edit-price="controller.startPrice" @create-charge="controller.startCharge()" @correct-charge="controller.startCharge" @save-price="controller.savePrice()" @save-charge="controller.saveCharge()" @price-visible="controller.priceVisible" @charge-visible="controller.chargeVisible" @location-page="controller.locationPage" @page="controller.page" @history="controller.showHistory" @close-history="controller.closeHistory()" @previous-history="controller.previousHistory()" @next-history="controller.nextHistory()" />
</template>
