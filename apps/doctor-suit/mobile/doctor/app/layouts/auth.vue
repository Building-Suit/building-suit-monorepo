<script setup lang="ts">
defineOptions({name:'DoctorNativeAuthLayout'})
const{product}=useDoctorNativeAuthPresentation()
</script>
<template><BsProductAuthFrame :product="product"><slot/></BsProductAuthFrame></template>
