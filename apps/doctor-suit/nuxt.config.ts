export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],
  devServer: { host: '127.0.0.1', port: 3006 },
  i18n: { baseUrl: '', locales: [{ code: 'en', language: 'en-US', file: 'en.json' }, { code: 'ar', language: 'ar-EG', dir: 'rtl', file: 'ar.json' }] },
  routeRules: { '/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } } },
})
