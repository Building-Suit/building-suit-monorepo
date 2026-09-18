<script setup lang="ts">
import { NuxtLink } from '#components';

const { toggleMenu } = useNavigation();
</script>

<template>
  <div class="flex items-center gap-2">
    <ThemeToggle />

    <LanguageSwitcher />

    <Button
      :as="NuxtLink"
      to="/auth/login"
      variant="outline"
      @click="() => toggleMenu()"
    >
      {{ $t('login') }}
    </Button>

    <Button
      :as="NuxtLink"
      to="#pricing"
      variant="secondary"
      @click="() => toggleMenu()"
    >
      {{ $t('startFreeTrial') }}
    </Button>
  </div>
</template>
