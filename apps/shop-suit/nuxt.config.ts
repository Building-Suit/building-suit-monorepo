export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],
  modules: ['@nuxtjs/supabase'],
  runtimeConfig: { public: { appUrl: process.env.APP_URL, portalKey: 'shop-crm' } },
  supabase: {
    redirect: false,
    // Independent product/environment session; no cross-product SSO.
    cookiePrefix: `bs-shop-${process.env.APP_ENV || 'local'}-auth-token`,
    clientOptions: {
      db: { schema: 'public' },
    },
  },

  i18n: {
    baseUrl: process.env.APP_URL || 'http://localhost:3001',
    strategy: 'no_prefix',
    defaultLocale: 'ar',
    defaultDirection: 'rtl',
    detectBrowserLanguage: { useCookie: true, cookieKey: 'building-suit-locale', fallbackLocale: 'en' },
    locales: [
      {
        code: 'ar',
        name: 'العربية',
        file: 'ar.ts',
        dir: 'rtl',
      },
      {
        code: 'en',
        name: 'English',
        file: 'en.ts',
        dir: 'ltr',
      },
    ],
    langDir: 'locales',

  },
});
