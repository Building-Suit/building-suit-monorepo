import postgres, { type Sql } from 'postgres'

let operatorClient: Sql | null = null

export function useControlOperatorDb() {
  if (operatorClient) return operatorClient
  const config = useRuntimeConfig()
  const connectionString = String(config.controlOperatorDatabaseUrl || '').trim()
  if (!connectionString) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Operator database is not configured',
      message: 'Set NUXT_CONTROL_OPERATOR_DATABASE_URL to a dedicated control-plane writer connection string.',
    })
  }
  const sslMode = String(config.controlDatabaseSsl || 'require').toLowerCase()
  operatorClient = postgres(connectionString, {
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: sslMode === 'disable' ? false : 'require',
    connection: { application_name: 'automation-suit-operator' },
  })
  return operatorClient
}
