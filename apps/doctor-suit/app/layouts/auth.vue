<script setup lang="ts">
const { product } = useDoctorAuthPresentation()
</script>
<template>
  <BsProductAuthFrame :product="product"><slot /></BsProductAuthFrame>
</template>
