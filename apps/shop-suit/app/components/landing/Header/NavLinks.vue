<script setup lang="ts">
import { NuxtLink } from '#components';

const { navLinks, toggleMenu } = useNavigation();
</script>

<template>
  <Button
    v-for="link in navLinks"
    :key="link.to"
    :as="NuxtLink"
    :to="link.to"
    variant="ghost"
    class="text-muted-foreground"
    @click="() => toggleMenu()"
  >
    {{ $t(`nav.${link.label}`) }}
  </Button>
</template>
