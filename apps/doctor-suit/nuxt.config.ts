import { doctorProviderConfiguration } from './app/utils/authConfiguration'
import { existsSync } from 'node:fs'
import { brands, resolveBrandAssets } from '@building-suit/brand'
const provider = doctorProviderConfiguration(process.env)
const brand = resolveBrandAssets(brands.doctor.assetPrefix, filename => existsSync(new URL(`../../packages/brand/assets/${filename}`, import.meta.url)))
export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],
  app: { head: { link: brand.icons } },
  runtimeConfig: { doctorAuthEmailLookupKey: process.env.DOCTOR_AUTH_EMAIL_LOOKUP_KEY || '', public: { doctorBrand: { assetPrefix: brand.assetPrefix }, doctorAuth: {
    configured: provider.enabled, environment: provider.environment, origin: provider.origin,
    url: provider.url, key: provider.key, cookiePrefix: provider.cookiePrefix,
  } } },
  devServer: { host: '127.0.0.1', port: 3006 },
  i18n: { baseUrl: '', locales: [{ code: 'en', language: 'en-US', file: 'en.json' }, { code: 'ar', language: 'ar-EG', dir: 'rtl', file: 'ar.json' }] },
  routeRules: { '/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } } },
})
