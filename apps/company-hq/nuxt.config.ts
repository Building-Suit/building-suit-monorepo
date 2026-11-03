export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],
  compatibilityDate: '2026-11-03',
  devtools: { enabled: false },
  devServer: { host: '127.0.0.1', port: 3101 },
  i18n: { locales: [{ code: 'en', language: 'en-US', file: 'en.json' }, { code: 'ar', language: 'ar-EG', dir: 'rtl', file: 'ar.json' }] },
  nitro: { preset: 'node-server', externals: { external: ['node:sqlite'] } },
  app: { head: { title: 'Building Suit HQ', script: [{ key: 'hq-theme-default', innerHTML: "try{if(!localStorage.getItem('building-suit.theme'))document.documentElement.dataset.theme='dark'}catch{}", tagPosition: 'head' }] } },
  routeRules: { '/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } } },
})
