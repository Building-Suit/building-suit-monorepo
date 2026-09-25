import postgres, { type Sql } from 'postgres'

let client: Sql | null = null

export function useControlDb() {
  if (client) return client

  const config = useRuntimeConfig()
  const connectionString = String(config.controlDatabaseUrl || '').trim()

  if (!connectionString) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Control-plane database is not configured',
      message: 'Set NUXT_CONTROL_DATABASE_URL to the dedicated read-only dashboard connection string.',
    })
  }

  const sslMode = String(config.controlDatabaseSsl || 'require').toLowerCase()

  client = postgres(connectionString, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: sslMode === 'disable' ? false : 'require',
    connection: {
      application_name: 'automation-suit-dashboard',
    },
  })

  return client
}
