export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],

  runtimeConfig: {
    controlDatabaseUrl: process.env.NUXT_CONTROL_DATABASE_URL || '',
    controlOperatorDatabaseUrl: process.env.NUXT_CONTROL_OPERATOR_DATABASE_URL || '',
    controlDatabaseSsl: process.env.NUXT_CONTROL_DATABASE_SSL || 'require',
    dashboardUsername: process.env.NUXT_DASHBOARD_USERNAME || '',
    dashboardPassword: process.env.NUXT_DASHBOARD_PASSWORD || '',
    dashboardAuthRequired: process.env.NUXT_DASHBOARD_AUTH_REQUIRED !== 'false',
    staleTaskMinutes: Number(process.env.NUXT_STALE_TASK_MINUTES || '20'),
    staleExecutionMinutes: Number(process.env.NUXT_STALE_EXECUTION_MINUTES || '60'),
    runtimeHeartbeatSeconds: Number(process.env.NUXT_RUNTIME_HEARTBEAT_SECONDS || '120'),
    public: {
      appUrl: process.env.APP_URL || 'http://localhost:3015',
      portalKey: 'automation-suit',
      refreshSeconds: Number(process.env.NUXT_PUBLIC_DASHBOARD_REFRESH_SECONDS || '15'),
    },
  },

  i18n: {
    baseUrl: process.env.APP_URL || 'http://localhost:3015',
    locales: [
      { code: 'en', name: 'English', language: 'en-US', dir: 'ltr', file: 'en.json' },
      { code: 'ar', name: 'العربية', language: 'ar-EG', dir: 'rtl', file: 'ar.json' },
    ],
  },
})
