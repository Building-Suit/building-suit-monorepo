<script setup lang="ts">
const { product } = useDoctorAuthPresentation()
</script>
<template>
  <BsProductAuthFrame :product="{ ...product, presentation: 'glass' }"><slot /></BsProductAuthFrame>
</template>
