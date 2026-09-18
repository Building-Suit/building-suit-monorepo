<script setup lang="ts">
const { withSvg = true, svgFill = 'fill-background' } = defineProps<{
  withSvg?: boolean;
  svgFill?: string;
}>();
</script>

<template>
  <section class="relative overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0 hero-gradient"></div>

    <!-- Dots overlay -->
    <div class="absolute inset-0 hero-dots opacity-40"></div>

    <!-- Content slot -->
    <div class="relative h-full z-10 py-20 lg:py-32">
      <slot />
    </div>

    <!-- Bottom wave -->
    <div v-if="withSvg" class="absolute bottom-0 inset-x-0">
      <svg viewBox="50 0 800 70" preserveAspectRatio="none">
        <path
          d="M0,40 C240,100 480,0 720,20 960,40 1200,80 1440,60 L1440,120 L0,120 Z"
          :class="svgFill"
        />
      </svg>
    </div>
  </section>
</template>

<style scoped>
.hero-gradient {
  background:
    radial-gradient(
      circle at top right,
      rgba(255, 255, 255, 0.08),
      transparent 60%
    ),
    linear-gradient(
      180deg,
      var(--primary-dark) 0%,
      var(--primary-dark) 50%,
      var(--primary-dark) 100%
    );
}

.hero-dots {
  background-image: radial-gradient(
    rgba(255, 255, 255, 0.15) 2px,
    transparent 2px
  );
  background-size: 50px 50px;

  /* 🔒 Makes dots fixed relative to viewport */
  background-attachment: fixed;
}
</style>
