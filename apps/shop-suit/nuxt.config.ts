// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync } from 'node:fs';
import type { Plugin as VitePlugin } from 'vite';

/**
 * pinia's exports map resolves to a CJS build (dist/pinia.prod.cjs) under the
 * node+import+production conditions that production SSR builds use. The
 * CJS->ESM interop then emits `import Vue__default from 'vue'`, which Node >= 22
 * refuses ("The requested module 'vue' does not provide an export named
 * 'default'"). Substituting the ESM build's content at load time fixes the
 * bundling in both the Vite SSR pass and Nitro's Rollup server build.
 */
const PINIA_CJS_RE = /[\\/]pinia[\\/](dist[\\/]pinia(\.prod)?|index)\.cjs$/;

const piniaEsmPlugin = {
  name: 'shop-crm:pinia-esm-build',
  load(id: string) {
    if (!PINIA_CJS_RE.test(id)) return null;
    const esm = /[\\/]index\.cjs$/.test(id)
      ? id.replace(/[\\/]index\.cjs$/, '/dist/pinia.mjs')
      : id.replace(/pinia(\.prod)?\.cjs$/, 'pinia.mjs');
    return { code: readFileSync(esm, 'utf8'), map: null };
  },
} satisfies Partial<VitePlugin>;

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  vite: {
    plugins: [piniaEsmPlugin as VitePlugin],
  },

  // Same substitution for Nitro's Rollup server build, where the runtime crash
  // actually happens.
  nitro: {
    hooks: {
      'rollup:before': nitro => {
        const cfg = (nitro.options.rollupConfig ?? {}) as { plugins?: unknown[] };
        cfg.plugins = [...(cfg.plugins ?? []), piniaEsmPlugin];
        nitro.options.rollupConfig = cfg as unknown as typeof nitro.options.rollupConfig;
      },
    },
  },

  runtimeConfig: {
    // Public config
    public: {
      appUrl: process.env.APP_URL,
      portalKey: process.env.PORTAL,

      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY ?? process.env.SUPABASE_ANON_KEY,
    },
  },

  router: {
    options: {
      scrollBehaviorType: 'smooth',
    },
  },

  app: {
    head: {
      // Apply saved/system theme before hydration to avoid a flash of the wrong theme
      script: [
        {
          innerHTML: `(function(){try{var s=localStorage.getItem('bs-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(!s&&m)){document.documentElement.classList.add('dark')}else if(s==='light'){document.documentElement.classList.remove('dark')}}catch(e){}})();`,
          tagPosition: 'head',
          tagPriority: 'critical',
        },
      ],
    },
  },

  modules: [
    '@nuxtjs/supabase',
    '@nuxtjs/tailwindcss',
    'shadcn-nuxt',
    '@vueuse/nuxt',
    '@nuxt/icon',
    '@nuxtjs/i18n',
  ],

  supabase: {
    redirect: false,
    // Shop Suit data belongs to the hosted shop_crm schema. Keep Auth on the
    // same Supabase project; data queries use this schema by default.
    clientOptions: {
      db: { schema: 'shop_crm' },
    },
  },

  shadcn: {
    /**
     * Prefix for all the imported component.
     * @default "Ui"
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * Will respect the Nuxt aliases.
     * @link https://nuxt.com/docs/api/nuxt-config#alias
     * @default "@/components/ui"
     */
    componentDir: '@/components/ui',
  },

  i18n: {
    baseUrl: process.env.APP_URL,
    strategy: 'no_prefix',
    defaultLocale: 'ar',
    defaultDirection: 'rtl',
    detectBrowserLanguage: false, // Disable browser detection
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
    experimental: {
      localeDetector: 'localeDetector.ts',
    },
  },
});
