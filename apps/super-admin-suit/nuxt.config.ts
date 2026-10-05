const environment = process.env.APP_ENV || 'local'
const expectedCookiePrefix = `bs-super-admin-${environment}-auth-token`
if (process.env.NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX && process.env.NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX !== expectedCookiePrefix) {
  throw new Error('Super Admin requires its own environment-scoped cookie namespace')
}

export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],
  modules: ['@nuxtjs/supabase'],
  supabase: {
    redirect: false,
    cookiePrefix: process.env.NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX || `bs-super-admin-${process.env.APP_ENV || 'local'}-auth-token`,
    cookieOptions: { path: '/', sameSite: 'lax', secure: environment !== 'local' },
    clientOptions: { db: { schema: 'public' } },
  },
  i18n: {
    baseUrl: process.env.APP_URL || 'http://localhost:3004',
    locales: [
      { code: 'en', name: 'English', language: 'en-US', dir: 'ltr', file: 'en.json' },
      { code: 'ar', name: 'العربية', language: 'ar-EG', dir: 'rtl', file: 'ar.json' },
    ],
  },
})
