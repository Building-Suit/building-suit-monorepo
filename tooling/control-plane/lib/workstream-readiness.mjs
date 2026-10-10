export const CONSERVATIVE_PUBLICATION_POLICY = Object.freeze({
  merge_authorized: false,
  deployment_authorized: false,
  hosted_database_changes_authorized: false,
  review_required_before_integration: true,
})

export function completePublicationPolicy(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Object.keys(CONSERVATIVE_PUBLICATION_POLICY).every(key =>
      typeof value[key] === 'boolean',
    )
  )
}

export function publicationPolicyBackfill(value) {
  return completePublicationPolicy(value)
    ? value
    : { ...CONSERVATIVE_PUBLICATION_POLICY }
}

export function mergeVerificationConfig(projectConfig = {}, workstreamConfig = {}) {
  const commands = new Map()
  for (const config of [projectConfig, workstreamConfig]) {
    for (const command of config?.commands ?? []) {
      commands.set(command?.name, command)
    }
  }

  return {
    ...(projectConfig ?? {}),
    ...(workstreamConfig ?? {}),
    commands: [...commands.values()],
    legacy_plan_mappings: {
      ...(projectConfig?.legacy_plan_mappings ?? {}),
      ...(workstreamConfig?.legacy_plan_mappings ?? {}),
    },
  }
}

export function safeRegisteredCommand(command) {
  const cwd = command?.cwd
  const shellPrograms = new Set([
    'bash', 'cmd', 'dash', 'fish', 'powershell', 'pwsh', 'sh', 'zsh',
  ])
  return Boolean(
    command?.name &&
    typeof command.program === 'string' &&
    /^[a-zA-Z0-9._+-]+$/.test(command.program) &&
    !shellPrograms.has(command.program.toLowerCase()) &&
    Array.isArray(command.args ?? []) &&
    (command.args ?? []).every(argument => typeof argument === 'string') &&
    (
      cwd == null ||
      (
        typeof cwd === 'string' &&
        !cwd.startsWith('/') &&
        !cwd.split(/[\\/]/).includes('..')
      )
    )
  )
}

function supabaseInvocation(command) {
  if (command.program === 'supabase') return command.args ?? []
  if (
    command.program === 'pnpm' &&
    command.args?.[0] === 'exec' &&
    command.args?.[1] === 'supabase'
  ) {
    return command.args.slice(2)
  }
  return null
}

export function safeLocalSupabaseCommand(command, phase) {
  if (!safeRegisteredCommand(command)) return false
  const invocation = supabaseInvocation(command)
  if (!invocation) return false
  if (invocation.some(argument =>
    argument === '--linked' ||
    argument === '--db-url' ||
    argument === '--project-ref' ||
    argument.startsWith('--db-url=') ||
    argument.startsWith('--project-ref='),
  )) return false

  if (phase === 'start') return invocation[0] === 'start'
  if (phase === 'reset') {
    return invocation[0] === 'db' && invocation[1] === 'reset' && invocation.includes('--local')
  }
  if (phase === 'test') {
    return invocation[0] === 'test' && invocation[1] === 'db' && invocation.includes('--local')
  }
  return false
}

export function validateLocalSupabaseLifecycle(database = {}) {
  if (database.kind !== 'supabase-local' || database.local_only !== true) {
    return { valid: false, reason: 'local_database_contract_incomplete' }
  }

  const phases = {
    start: database.start_when_needed === true ? database.start_commands : [],
    reset: database.reset_commands,
    test: database.test_commands,
  }
  if (database.start_when_needed === true && !Array.isArray(phases.start)) {
    return { valid: false, reason: 'local_database_start_commands_missing' }
  }
  if (!Array.isArray(phases.reset) || phases.reset.length === 0) {
    return { valid: false, reason: 'local_database_reset_commands_missing' }
  }
  if (!Array.isArray(phases.test) || phases.test.length === 0) {
    return { valid: false, reason: 'local_database_test_commands_missing' }
  }

  const commands = []
  const names = new Set()
  for (const [phase, entries] of Object.entries(phases)) {
    for (const command of entries ?? []) {
      if (!safeLocalSupabaseCommand(command, phase)) {
        return { valid: false, reason: `local_database_${phase}_command_invalid` }
      }
      if (names.has(command.name)) {
        return { valid: false, reason: 'local_database_command_names_not_unique' }
      }
      names.add(command.name)
      commands.push({ ...command, phase, required: command.required !== false })
    }
  }
  return { valid: true, commands }
}
