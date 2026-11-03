export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],
  i18n: { baseUrl: process.env.APP_URL || 'http://localhost:3003', locales: [{ code: 'en', language: 'en-US', file: 'en.json' }, { code: 'ar', language: 'ar-EG', dir: 'rtl', file: 'ar.json' }] },
})
