export default defineEventHandler(() => ({
  writesEnabled: Boolean(String(useRuntimeConfig().controlOperatorDatabaseUrl || '').trim()),
}))
