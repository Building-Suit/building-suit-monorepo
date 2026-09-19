// Standalone test fixture using the existing workspace runtime and UI layer.
// Ledger's app/ and Supabase module are deliberately not extended/imported.
export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],
  compatibilityDate: '2026-08-30',
  ssr: false,
  devtools: { enabled: false },
  i18n: {
    locales: [{ code: 'en', language: 'en-US', dir: 'ltr' }, { code: 'ar', language: 'ar-EG', dir: 'rtl' }],
    detectBrowserLanguage: false,
  },
})
