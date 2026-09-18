<template>
  <div class="min-h-screen flex flex-col bg-background">
    <LandingHeader />

    <main class="flex flex-col flex-1 bg-background">
      <slot />
    </main>

    <LandingFooter />
  </div>
</template>
