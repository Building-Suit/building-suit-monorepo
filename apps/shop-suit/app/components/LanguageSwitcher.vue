<script setup>
const { locale, locales, setLocale } = useI18n();

const availableLocales = computed(() => {
  return locales.value.filter(i => i.code !== locale.value);
});
</script>

<template>
  <Button
    v-for="link in availableLocales"
    :key="link.code"
    variant="ghost"
    class="text-muted-foreground"
    @click.prevent.stop="setLocale(link.code)"
  >
    <Icon name="solar:global-outline" size="20" />
    {{ link.name }}
  </Button>
</template>
