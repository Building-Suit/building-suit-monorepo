export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],
  modules: ['@nuxtjs/supabase'],
  runtimeConfig: { public: { appUrl: process.env.APP_URL, portalKey: 'inventory-suit' } },
  supabase: {
    redirect: false,
    cookiePrefix: process.env.NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX || `bs-inventory-${process.env.APP_ENV || 'local'}-auth-token`,
    clientOptions: { db: { schema: 'public' } },
  },
  i18n: {
    baseUrl: process.env.APP_URL || 'http://localhost:3003',
    locales: [
      { code: 'en', name: 'English', language: 'en-US', dir: 'ltr', file: 'en.json' },
      { code: 'ar', name: 'العربية', language: 'ar-EG', dir: 'rtl', file: 'ar.json' },
    ],
  },
})
