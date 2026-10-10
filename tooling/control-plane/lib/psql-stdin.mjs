// Keep receipt/evidence values off argv (Linux limits each argument to 128 KiB).
// Hex carries arbitrary UTF-8 through psql stdin without interpreting quotes,
// newlines, backslashes or psql commands. Existing :'variable' SQL escaping and
// the caller's database role remain authoritative.
export const MAX_PSQL_VARIABLE_BYTES = 16 * 1024 * 1024

export function psqlStdinRequest(args, options = {}) {
  const remaining = [], values = new Map()
  let bytes = 0
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--set') { remaining.push(args[i]); continue }
    const assignment = args[++i]
    const equals = typeof assignment === 'string' ? assignment.indexOf('=') : -1
    const name = equals < 0 ? '' : assignment.slice(0, equals)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw Error('psql_variable_name_invalid')
    const value = assignment.slice(equals + 1)
    if (value.includes('\0')) throw Error('psql_variable_nul_invalid')
    bytes += Buffer.byteLength(value)
    if (bytes > MAX_PSQL_VARIABLE_BYTES) throw Error('psql_variable_budget_exceeded')
    values.set(name, value)
  }
  if (!values.size) return { args, options }
  const columns = [...values].map(([name, value]) =>
    `convert_from(decode('${Buffer.from(value).toString('hex')}','hex'),'UTF8') AS "${name}"`,
  )
  return {
    args: remaining,
    options: { ...options, input: `SELECT ${columns.join(',')}\n\\gset\n${options.input ?? ''}` },
  }
}
