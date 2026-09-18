<script setup lang="ts">
const { navLinks, companyLinks, legalLinks } = useNavigation();

const footerColumns = [
  { label: 'product', links: navLinks },
  { label: 'company', links: companyLinks },
  { label: 'legal', links: legalLinks },
];
</script>

<template>
  <footer class="bg-primary-dark text-primary-foreground py-16 px-6">
    <div class="max-w-6xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div class="flex flex-col gap-6">
          <NuxtLink to="/" class="flex flex-col">
            <span class="font-extrabold text-xl tracking-tight text-secondary">
              Shop CRM
            </span>
            <span class="text-xs opacity-70 tracking-tight">
              by <strong>Building Suit</strong>
            </span>
          </NuxtLink>

          <p class="text-sm leading-relaxed text-muted-foreground">
            {{ $t('footer.description') }}
          </p>
        </div>

        <div
          v-for="column in footerColumns"
          :key="column.label"
          class="flex flex-col gap-6"
        >
          <h3 class="font-semibold text-lg">
            {{ $t(`footer.${column.label}`) }}
          </h3>

          <ul class="flex flex-col gap-2 text-muted-foreground">
            <li v-for="link in column.links" :key="link.to">
              <NuxtLink :to="link.to" class="hover:underline">
                {{ $t(`nav.${link.label}`) }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <div
        class="lg:flex grid gap-4 text-center items-center lg:justify-between border-t border-primary-foreground/10 pt-8"
      >
        <p>
          © {{ new Date().getFullYear() }} Shop CRM
          <small>by <strong>Building Suit</strong></small>
          . {{ $t('footer.allRightsReserved') }}.
        </p>

        <LanguageSwitcher />
      </div>
    </div>
  </footer>
</template>
