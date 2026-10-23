<script setup lang="ts">
const{product}=useDoctorNativeAuthPresentation()
</script>
<template><BsProductAuthFrame :product="product"><slot/></BsProductAuthFrame></template>
