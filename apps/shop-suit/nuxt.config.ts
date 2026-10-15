import { existsSync } from 'node:fs'

export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],
  modules: ['@nuxtjs/supabase'],
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/brand/shop-suit-mark-light.svg' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/brand/shop-suit-email-mark.png' },
      ],
    },
  },
  runtimeConfig: { public: {
    appUrl: process.env.APP_URL, portalKey: 'shop-crm',
    appEnvironment: process.env.APP_ENV || 'local',
    // #318 owns the route. Include it only in builds where that file exists.
    changelogAvailable: existsSync(new URL('./app/pages/changelog.vue', import.meta.url)),
    gaMeasurementId: '', searchConsoleVerification: '',
  } },
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
