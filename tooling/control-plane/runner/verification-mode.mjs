const supportedModes = new Set([
  'focused',
  'milestone',
  'release',
])

const safePlanCommands = new Map([
  ['git diff --check', { name: 'git-diff-check', program: 'git', args: ['diff', '--check'] }],
  ['pnpm lint', { name: 'root-lint', program: 'pnpm', args: ['lint'] }],
  ['pnpm test', { name: 'root-test', program: 'pnpm', args: ['test'], timeout_ms: 30 * 60 * 1000 }],
  ['pnpm check', { name: 'workspace-check', program: 'pnpm', args: ['check'] }],
  ['pnpm typecheck', { name: 'root-typecheck', program: 'pnpm', args: ['typecheck'], timeout_ms: 20 * 60 * 1000 }],
  ['pnpm build', { name: 'root-build', program: 'pnpm', args: ['build'], timeout_ms: 30 * 60 * 1000 }],
  ['pnpm automation:resilience', { name: 'automation-resilience', program: 'pnpm', args: ['automation:resilience'] }],
])

function normalizedCommand(program, args = []) {
  return [program, ...args].join(' ').trim().replace(/\s+/g, ' ')
}

export function safeRegisteredVerificationCommand(command) {
  const cwd = command?.cwd
  return Boolean(
    command?.name &&
    typeof command.program === 'string' &&
    /^[a-zA-Z0-9._+-]+$/.test(command.program) &&
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

export function resolveVerificationPlan({ entries = [], configuredCommands = [] }) {
  const registered = new Map()
  for (const command of configuredCommands) {
    if (!safeRegisteredVerificationCommand(command)) continue
    registered.set(normalizedCommand(command.program, command.args), command)
    registered.set(String(command.name).trim(), command)
  }

  const checks = []
  const unenforced = []
  for (const rawEntry of entries) {
    const entry = typeof rawEntry === 'string' ? rawEntry.trim().replace(/\s+/g, ' ') : ''
    const command = safePlanCommands.get(entry) ?? registered.get(entry)
    if (!entry || !command) {
      unenforced.push(typeof rawEntry === 'string' ? rawEntry : JSON.stringify(rawEntry))
      continue
    }
    checks.push({
      ...command,
      args: [...(command.args ?? [])],
      required: true,
      plan_entry: entry,
    })
  }

  return { checks, unenforced }
}

export function resolveDatabaseVerification({ verificationConfig = {}, suitSlug, appPath, changedDatabaseTests = [] }) {
  const configured = verificationConfig.database
  if (configured?.commands?.length > 0) {
    if (!configured.commands.every(safeRegisteredVerificationCommand)) {
      return { source: 'invalid_configuration', commands: [] }
    }
    return {
      source: 'registered_verification_config',
      commands: configured.commands.map(command => ({
        ...command,
        name: command.name ?? 'database-tests',
        required: command.required !== false,
      })),
    }
  }

  // Compatibility contracts for already-registered products. New workstreams
  // must provide verification_config.database instead of adding another slug.
  if (suitSlug === 'ledger-suit') {
    const commands = [{
      name: 'database-reset', program: 'pnpm',
      args: ['exec', 'supabase', 'db', 'reset', '--local'], cwd: appPath,
      timeout_ms: 20 * 60 * 1000,
    }]
    if (changedDatabaseTests.length > 0) {
      commands.push({
        name: 'database-tests', program: 'pnpm',
        args: ['exec', 'supabase', 'test', 'db', ...changedDatabaseTests, '--local'], cwd: appPath,
      })
    }
    return { source: 'legacy_ledger_compatibility', commands }
  }
  if (suitSlug === 'shop-suit') {
    return {
      source: 'legacy_shop_compatibility',
      commands: [{ name: 'database-tests', program: 'pnpm', args: ['db:test:shop'], timeout_ms: 30 * 60 * 1000 }],
    }
  }
  return { source: 'missing', commands: [] }
}

export function classifyVerificationResults(checks = []) {
  const blocking = checks.filter(check => ['fail', 'not_run'].includes(check.status))
  if (blocking.length === 0) return { failure_class: null, recovery_action: null }

  const classes = new Set(blocking.map(check => check.failure_class).filter(Boolean))
  const priority = [
    ['verification-lifecycle', 'reverify'],
    ['verification-configuration', 'wait-operator'],
    ['verification-infrastructure', 'wait-external'],
    ['verification-required-check-unavailable', 'wait-operator'],
    ['verification-product-defect', 'repair'],
  ]
  for (const [failureClass, recoveryAction] of priority) {
    if (classes.has(failureClass)) {
      return { failure_class: failureClass, recovery_action: recoveryAction }
    }
  }
  return { failure_class: 'verification-product-defect', recovery_action: 'repair' }
}

export function resolveVerificationMode(packet) {
  const configured =
    packet.task?.verification_mode ??
    packet.task?.metadata?.verification_mode ??
    packet.workstream?.verification_config?.mode ??
    packet.project?.verification_config?.mode

  const mode =
    configured ??
    (packet.task?.task_type === 'release'
      ? 'release'
      : 'focused')

  if (!supportedModes.has(mode)) {
    throw new Error(
      `unsupported_verification_mode:${mode}`,
    )
  }

  return mode
}

export function isMilestoneVerification(mode) {
  return mode === 'milestone' || mode === 'release'
}

export function changedPathMatches(changedFiles, prefixes) {
  return prefixes.length === 0 || changedFiles.some(file =>
    prefixes.some(prefix => file.startsWith(prefix)),
  )
}

export function customCheckSelection({
  check,
  changedFiles,
  mode,
  verificationPlanText = '',
}) {
  const prefixes = Array.isArray(check.changed_paths)
    ? check.changed_paths
    : []
  const pathMatched = changedPathMatches(changedFiles, prefixes)
  const required = check.required !== false

  if (
    check.name &&
    verificationPlanText.includes(String(check.name).toLowerCase())
  ) {
    return {
      selected: true,
      reason: 'required_by_task_verification_plan',
    }
  }

  if (pathMatched) {
    return {
      selected: true,
      reason: prefixes.length === 0
        ? 'required_by_workstream_contract'
        : 'changed_path_matched',
    }
  }

  if (required && isMilestoneVerification(mode)) {
    return {
      selected: true,
      reason: 'required_by_milestone_contract',
    }
  }

  return {
    selected: false,
    reason: required
      ? 'outside_focused_changed_scope'
      : 'optional_check_no_changed_path_match',
  }
}

export function applicationScopeSelected({
  appPath,
  changedFiles,
  mode,
  verificationPlanText,
}) {
  if (isMilestoneVerification(mode)) {
    return {
      selected: true,
      reason: 'required_by_milestone_contract',
    }
  }

  if (
    appPath &&
    changedFiles.some(file =>
      file === appPath || file.startsWith(`${appPath}/`),
    )
  ) {
    return {
      selected: true,
      reason: 'changed_file_in_application_scope',
    }
  }

  if (/typecheck|lint|unit test|build/.test(verificationPlanText)) {
    return {
      selected: true,
      reason: 'required_by_task_verification_plan',
    }
  }

  return {
    selected: false,
    reason: 'outside_focused_application_scope',
  }
}

export function controlPlaneRootLintSelection({
  changedFiles,
}) {
  if (
    changedFiles.some(file =>
      file.startsWith('tooling/control-plane/') &&
      /\.(?:c|m)?js$/.test(file),
    )
  ) {
    return {
      selected: true,
      reason: 'changed_control_plane_javascript',
    }
  }

  return {
    selected: false,
    reason: 'no_changed_control_plane_javascript',
  }
}

export function commandResultStatus({
  required,
  exitCode,
  errorCode,
}) {
  if (errorCode === 'ENOENT') {
    return required
      ? 'not_run'
      : 'skipped'
  }

  if (exitCode === 0 && !errorCode) {
    return 'pass'
  }

  return required
    ? 'fail'
    : 'skipped'
}
