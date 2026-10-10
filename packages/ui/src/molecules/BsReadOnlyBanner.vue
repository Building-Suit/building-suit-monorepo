<script setup lang="ts">defineProps<{ title: string; description: string; actionLabel?: string; actionTo?: string }>()</script>
<template><BsAlert tone="warning" :title="title" :description="description"><BsLink v-if="actionLabel && actionTo" :to="actionTo" variant="standalone">{{ actionLabel }}</BsLink></BsAlert></template>
