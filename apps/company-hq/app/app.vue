<script setup lang="ts">
// HQ starts in the approved dark office theme; explicit shared preferences persist.
const theme = useTheme()
onMounted(() => {
  try { if (!localStorage.getItem('building-suit.theme')) theme.set('dark') } catch { theme.set('dark') }
})
</script>
<template><BsAppRoot :layout="false" /></template>
