import { legacyClassification } from './dot.mjs'
import {
  completePublicationPolicy,
  mergeVerificationConfig,
  safeRegisteredCommand,
  validateLocalSupabaseLifecycle,
} from '../lib/workstream-readiness.mjs'

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
  return safeRegisteredCommand(command)
}

function normalizedPlanEntry(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function verificationPlanHasEntries(entries) {
  return Array.isArray(entries)&&entries.length>0&&entries.every(entry=>typeof entry==='string'?Boolean(entry.trim()):entry?.version===2&&['command','group','planned_test','external_gate','human_gate','blocker'].includes(entry.kind)&&Boolean(normalizedPlanEntry(entry.description??entry.title??entry.obligation_id)))
}

const semanticPatterns = [
  ['storage-policy', /\bstorage\b.*\b(?:rls|policy|tenant|anonymous|owner)\b|\b(?:rls|policy)\b.*\bstorage\b/i],
  ['signed-url-expiry', /signed(?:-| )?(?:access|url).*expir|expir.*signed(?:-| )?(?:access|url)/i],
  ['security-review', /security review|advisors?\/security|credential\/redaction/i],
  ['browser-security', /browser.*(?:leak|credential|secret|network)|(?:leak|credential|secret).*browser/i],
  ['generated-types', /generate typescript types|type generation|generated types/i],
  ['rls-authorization', /\brls\b|authorization.*(?:outsider|admin|tenant)|cross-tenant/i],
  ['browser', /\bbrowser\b|\bplaywright\b|\be2e\b/i],
  ['database', /\bdatabase\b|\bsql\b|\brpc\b|\bpgtap\b|\bdb:test\b/i],
]

export function verificationObligationCapabilities(entry) {
  const text = typeof entry === 'string'
    ? entry
    : String(entry?.description ?? entry?.title ?? entry?.obligation_id ?? '')
  return semanticPatterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([capability]) => capability)
}

function commandCapabilities(command) {
  return new Set(Array.isArray(command?.capabilities) ? command.capabilities : [])
}

function compatibilityPlanEntry(value) {
  const normalized = normalizedPlanEntry(value).replace(/[.;:]$/, '')
  const command = normalized.replace(/^run\s+/i, '')
  return safePlanCommands.has(command) ? command : normalized
}

export function resolveVerificationPlan({
  entries = [],
  configuredCommands = [],
  legacyMappings = {},
  phase = 'post_implementation',
}) {
  const registered = new Map()
  for (const command of configuredCommands) {
    if (!safeRegisteredVerificationCommand(command)) continue
    registered.set(normalizedCommand(command.program, command.args), command)
    registered.set(String(command.name).trim().toLowerCase(), command)
  }

  const checks = []
  const blockers = []
  const unenforced = []
  const deferred = []
  for (const rawEntry of entries) {
    const rawObject = rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry)
    const structured = rawObject && rawEntry.version === 2
      ? rawEntry
      : null
    const entry = typeof rawEntry === 'string'
      ? normalizedPlanEntry(rawEntry)
      : normalizedPlanEntry(structured?.description ?? structured?.title ?? structured?.obligation_id)
    const compatible = compatibilityPlanEntry(entry)
    const mapped = structured ?? legacyMappings?.[entry] ?? legacyMappings?.[compatible]
    const kind = structured?.kind ?? (mapped && typeof mapped === 'object' ? mapped.kind : null)

    if (rawObject && !structured) {
      blockers.push({
        plan_entry: JSON.stringify(rawEntry),
        kind: 'invalid_obligation',
        blocker: 'unsupported_verification_obligation_shape_or_version',
        required: true,
      })
      continue
    }

    if (mapped && typeof mapped === 'object' && mapped.version !== 2) {
      blockers.push({
        plan_entry: entry,
        kind: 'invalid_obligation',
        blocker: 'unsupported_verification_mapping_version',
        required: true,
      })
      continue
    }

    if (['human_gate', 'external_gate', 'planned_test', 'blocker'].includes(kind)) {
      const item = {
        plan_entry: entry || JSON.stringify(rawEntry),
        kind,
        blocker: structured?.blocker ?? mapped?.blocker ?? 'verification_obligation_requires_explicit_evidence',
        required: structured?.required !== false && mapped?.required !== false,
      }

      if (kind === 'planned_test') {
        const expectedOutputs = structured?.expected_outputs ?? mapped?.expected_outputs
        if (!Array.isArray(expectedOutputs) || expectedOutputs.length === 0
          || expectedOutputs.some(value => typeof value !== 'string' || !value.trim())) {
          blockers.push({
            ...item,
            kind: 'invalid_obligation',
            blocker: 'planned_test_expected_outputs_required',
          })
          continue
        }

        item.expected_outputs = [...expectedOutputs]
        item.required_post_implementation = true
        const commandRefs = structured?.commands ?? mapped?.commands ?? ((structured?.command ?? mapped?.command) ? [structured?.command ?? mapped?.command] : null)
        if (commandRefs) {
          if (expectedOutputs.some(output=>output.startsWith('/')||output.split('/').includes('..')||/[\r\n]/.test(output))) {
            blockers.push({...item,kind:'invalid_obligation',blocker:'task_owned_output_boundary_required'})
            continue
          }
          const materialized=resolveVerificationPlan({entries:[{version:2,kind:'group',description:entry,commands:commandRefs,requires:structured?.requires??mapped?.requires??[]}],configuredCommands,legacyMappings,phase})
          if(materialized.blockers.length||materialized.unenforced.length){blockers.push(...materialized.blockers);unenforced.push(...materialized.unenforced);continue}
          item.registered_checks=materialized.checks
        }

        const advisorGate =
          /advisor_evidence_unavailable/i.test(String(item.blocker)) ||
          /supabase.*advisor/i.test(String(item.plan_entry))

        item.phase = advisorGate
          ? 'pre_publication'
          : 'post_implementation'

        if (phase !== item.phase) {
          deferred.push(item)
          continue
        }
        if(item.registered_checks)checks.push(...item.registered_checks)
      }

      if (kind === 'external_gate') {
        item.phase = structured?.phase ?? mapped?.phase ?? 'pre_publication'
        const commandRefs = structured?.commands ?? mapped?.commands ?? ((structured?.command ?? mapped?.command) ? [structured?.command ?? mapped?.command] : [])
        if (commandRefs.length) {
          const collected = resolveVerificationPlan({entries:[{version:2,kind:'group',description:entry,commands:commandRefs,requires:structured?.requires??mapped?.requires??[]}],configuredCommands,legacyMappings,phase})
          if (collected.blockers.length || collected.unenforced.length) { blockers.push(...collected.blockers); unenforced.push(...collected.unenforced); continue }
          item.registered_checks = collected.checks
          // Collect evidence through the exact registered executable before
          // presenting acknowledgement. The operator cannot manufacture PASS.
          if (phase === 'post_implementation') checks.push(...collected.checks)
        }
        if (phase !== item.phase) {
          deferred.push(item)
          continue
        }
      }

      blockers.push(item)
      continue
    }

    if (!mapped) {
      const implicit = safePlanCommands.get(compatible) ?? registered.get(String(compatible).toLowerCase())
      if (!entry || !implicit) {
        unenforced.push(typeof rawEntry === 'string' ? rawEntry : JSON.stringify(rawEntry))
        continue
      }
    }
    const refs = structured?.commands ?? mapped?.commands ?? (
      structured?.command || (mapped && typeof mapped === 'object' && mapped.command)
        ? [structured?.command ?? mapped.command]
        : typeof mapped === 'string'
          ? [mapped]
          : [compatible]
    )
    const expectedShape = kind === 'group'
      ? Array.isArray(refs) && refs.length > 0
      : Array.isArray(refs) && refs.length > 0
    if (!expectedShape || refs.some(ref => typeof ref !== 'string' || !ref.trim())) {
      blockers.push({
        plan_entry: entry || JSON.stringify(rawEntry),
        kind: 'invalid_obligation',
        blocker: 'verification_command_references_malformed',
        required: true,
      })
      continue
    }
    const uniqueRefs = [...new Set(refs)]
    const resolvedRefs = uniqueRefs.map(ref => ({
      ref,
      command: safePlanCommands.get(ref) ?? registered.get(String(ref).toLowerCase()),
    }))
    const unknownReferences = resolvedRefs.filter(item => !item.command).map(item => item.ref)
    if (unknownReferences.length > 0) {
      blockers.push({
        plan_entry: entry || JSON.stringify(rawEntry),
        kind: kind ?? 'command',
        blocker: kind === 'group'
          ? 'verification_group_member_unregistered'
          : 'verification_command_unregistered',
        unknown_references: unknownReferences,
        required: true,
      })
      continue
    }
    const commands = resolvedRefs.map(item => item.command)
    if (!entry || commands.length === 0) {
      unenforced.push(typeof rawEntry === 'string' ? rawEntry : JSON.stringify(rawEntry))
      continue
    }

    const requiredCapabilities = new Set([
      ...verificationObligationCapabilities(rawEntry),
      ...(structured?.requires ?? mapped?.requires ?? []),
    ])
    const providedCapabilities = new Set(commands.flatMap(command => [...commandCapabilities(command)]))
    const missingCapabilities = [...requiredCapabilities].filter(capability => !providedCapabilities.has(capability))
    if (missingCapabilities.length > 0) {
      blockers.push({
        plan_entry: entry,
        kind: 'semantic_mismatch',
        blocker: 'verification_mapping_lacks_required_capability',
        missing_capabilities: missingCapabilities,
        mapped_commands: commands.map(command => command.name),
        required: true,
      })
      continue
    }

    for (const command of commands) {
      checks.push({
        ...command,
        args: [...(command.args ?? [])],
        required: true,
        plan_entry: entry,
      })
    }
  }

  return { checks, blockers, unenforced, deferred }
}

export function resolveDatabaseVerification({ verificationConfig = {}, suitSlug, appPath, changedDatabaseTests = [] }) {
  const configured = verificationConfig.database
  if (configured?.kind === 'supabase-local' || configured?.local_only != null) {
    const lifecycle = validateLocalSupabaseLifecycle(configured)
    return lifecycle.valid
      ? { source: 'registered_local_supabase_lifecycle', commands: lifecycle.commands }
      : { source: 'invalid_configuration', commands: [], reason: lifecycle.reason }
  }
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

function databaseScopeRequired(packet) {
  const paths = [
    ...(packet.publication_boundaries?.task_paths ?? []),
    ...(packet.publication_boundaries?.source_paths ?? []),
  ]
  const plan = JSON.stringify(packet.task?.verification_plan ?? []).toLowerCase()
  return paths.some(value => /(^|\/)supabase\//.test(String(value))) ||
    /\b(?:database|supabase|pgtap|db:test)\b/.test(plan)
}

export function evaluateVerificationReadiness(packet) {
  const config = mergeVerificationConfig(
    packet.project?.verification_config,
    packet.workstream?.verification_config,
  )
  const invalidCommand = (config.commands ?? []).find(command =>
    !safeRegisteredVerificationCommand(command),
  )
  if (invalidCommand) {
    return { ready: false, reason: 'registered_verification_command_invalid' }
  }
  const plan = resolveVerificationPlan({
    entries: packet.task?.verification_plan ?? [],
    configuredCommands: config.commands,
    legacyMappings: config.legacy_plan_mappings,
    phase: 'pre_implementation',
  })
  if (plan.unenforced.length > 0) {
    return {
      ready: false,
      reason: (config.commands ?? []).length === 0
        ? 'verification_commands_missing'
        : 'verification_plan_mapping_required',
      unenforced: plan.unenforced,
    }
  }
  if (plan.blockers.length > 0) {
    return {
      ready: false,
      reason: 'verification_obligation_blocked',
      blockers: plan.blockers,
    }
  }

  if (databaseScopeRequired(packet)) {
    const database = resolveDatabaseVerification({
      verificationConfig: config,
      suitSlug: packet.suit?.slug,
      appPath: packet.workstream?.application_path ?? packet.suit?.app_path,
    })
    if (database.commands.length === 0) {
      return {
        ready: false,
        reason: database.reason ?? 'database_verification_configuration_missing',
      }
    }
  }

  return { ready: true, reason: 'verification_configuration_ready', config, plan }
}

export function evaluateWorkstreamReadiness(packet) {
  if (!completePublicationPolicy(packet.workstream?.publication_config)) {
    return {
      ready: false,
      reason: 'publication_policy_incomplete',
      failure_class: 'publication-scope',
    }
  }
  const verification = evaluateVerificationReadiness(packet)
  return verification.ready
    ? verification
    : { ...verification, failure_class: 'verification-configuration' }
}

export function classifyVerificationResults(checks = []) {
  const blocking = checks.filter(check => ['fail', 'not_run','unavailable'].includes(check.status))
  if (blocking.length === 0) return { failure_class: null, recovery_action: null }

  const classes = new Set(blocking.map(check => legacyClassification(check.failure_class)).filter(Boolean))
  const priority = [
    ['verification-lifecycle', 'reverify'],
    ['verification-product-defect', 'repair'],
    ['verification-infrastructure', 'wait-external'],
    ['verification-required-check-unavailable', 'wait-operator'],
    ['verification-configuration', 'wait-operator'],
    ['unknown-outcome','reconcile'],
  ]
  for (const [failureClass, recoveryAction] of priority) {
    if (classes.has(failureClass)) {
      return { failure_class: failureClass, recovery_action: recoveryAction }
    }
  }
  return classes.size ? {failure_class:'safety-stop',recovery_action:'safety-stop'} : { failure_class: 'unknown-outcome', recovery_action: 'reconcile' }
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

export function requiredVerificationEvidenceMissing({ name, output = '' }) {
  if (name !== 'shop-payment-evidence-http') return false
  const failed = output.match(/^# fail (\d+)$/m)
  if (Number(failed?.[1] ?? 0) > 0) return false // executed assertions must remain product defects.
  const skipped = output.match(/^# skipped (\d+)$/m)
  const passed = output.match(/^# pass (\d+)$/m)
  return !passed || Number(passed[1]) === 0 || Number(skipped?.[1] ?? 0) > 0
}

export function verificationCommandFailureClass({ name, required = true, passed, errorCode, signal, output = '', missingEvidence = false }) {
  if (signal) return 'verification-infrastructure'
  if (required && missingEvidence) return 'verification-required-check-unavailable'
  if (passed || !required) return null
  if (errorCode === 'ENOENT') return 'verification-required-check-unavailable'
  if (errorCode === 'ETIMEDOUT') return 'verification-infrastructure'
  if (/EADDRINUSE|listen EPERM|spawn E2BIG/.test(output)) return 'verification-infrastructure'
  if (/No tests found|Cannot find module.*playwright|Playwright Test did not expect test|Failed to load.*config|Executable doesn't exist/.test(output)) return 'verification-configuration'
  if (errorCode && ['ECONNRESET','ECONNREFUSED','EPIPE'].includes(errorCode)) return 'verification-infrastructure'
  // A materialized HTTP check may still require separately provisioned local
  // identities and bridge fixtures. Preserve that missing prerequisite as a
  // required gate; an HTTP/RLS assertion failure remains a product defect.
  if (name === 'shop-payment-evidence-http' &&
      (/^(?:#\s*)?Error: SHOP_EVIDENCE_[A-Z_]+ is required for the disposable local evidence test$/m.test(output) ||
       /^(?:#\s*)?AssertionError \[ERR_ASSERTION\]: Disposable local payment-evidence fixture is required; missing: SHOP_EVIDENCE_[A-Z_]+(?:, SHOP_EVIDENCE_[A-Z_]+)*$/m.test(output))) {
    return 'verification-required-check-unavailable'
  }
  return 'unknown-outcome'
}
