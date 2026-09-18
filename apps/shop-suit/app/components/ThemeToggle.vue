<script setup lang="ts">
const { isDark, toggle } = useTheme();

const ariaKey = computed(() =>
  isDark.value ? 'a11y.switchToLight' : 'a11y.switchToDark',
);
</script>

<template>
  <Button
    variant="ghost"
    size="icon-sm"
    :aria-label="$t(ariaKey)"
    :title="$t(ariaKey)"
    @click="toggle"
  >
    <Icon v-if="isDark" name="lucide:sun" class="size-5" />
    <Icon v-else name="lucide:moon" class="size-5" />
  </Button>
</template>
