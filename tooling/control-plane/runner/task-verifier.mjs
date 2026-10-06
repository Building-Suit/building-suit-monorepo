#!/usr/bin/env node
import {failureEvidence,processFailureCategory} from './failure-evidence.mjs'
import {emptyComponentFixture} from './retry-exhaustion-audit.mjs'

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'

import {
  spawnSync,
} from 'node:child_process'

import path from 'node:path'

import {
  applicationScopeSelected,
  classifyVerificationResults,
  verificationCommandFailureClass,
  requiredVerificationEvidenceMissing,
  commandResultStatus,
  controlPlaneRootLintSelection,
  customCheckSelection,
  isMilestoneVerification,
  resolveDatabaseVerification,
  resolveVerificationPlan,
  resolveVerificationMode,
  safeRegisteredVerificationCommand,
} from './verification-mode.mjs'
import { localShopMigrationReadiness } from './local-migration-readiness.mjs'
import { mergeVerificationConfig } from '../lib/workstream-readiness.mjs'
import { publicationStateFingerprint } from './publication-preflight.mjs'
import { executeWithControlDatabaseRetry } from '../lib/control-database.mjs'

const [
  worktreePath,
  packetPath,
  runDirectory,
  verificationRunId,
  persistedVerificationMode,
] = process.argv.slice(2)

const verificationProbe =
  verificationRunId === 'probe'

function fail(message) {
  process.stdout.write(
    `${JSON.stringify({
      ok: false,
      error: message,
    })}\n`,
  )

  process.exit(1)
}

if (
  !worktreePath ||
  !packetPath ||
  !runDirectory ||
  (
    !verificationProbe &&
    !/^\d+$/.test(verificationRunId ?? '')
  )
) {
  fail(
    'worktree, packet, run directory and verification run ID are required',
  )
}

if (!existsSync(worktreePath)) {
  fail('worktree_not_found')
}

if (!existsSync(packetPath)) {
  fail('packet_not_found')
}

const packet =
  JSON.parse(
    readFileSync(
      packetPath,
      'utf8',
    ),
  )

const task =
  packet.task

const suit =
  packet.suit

const project = packet.project ?? {}
const workstream = packet.workstream ?? {}
const verificationConfig = mergeVerificationConfig(
  project.verification_config,
  workstream.verification_config,
)
const resolvedPlan = resolveVerificationPlan({
  entries: task.verification_plan ?? [],
  configuredCommands: verificationConfig.commands ?? [],
  legacyMappings: verificationConfig.legacy_plan_mappings ?? {},
})

const verificationMode =
  persistedVerificationMode ??
  resolveVerificationMode(packet)

if (
  verificationMode !==
  resolveVerificationMode(packet)
) {
  fail('persisted_verification_mode_mismatch')
}

const controlDatabase = {
  host: process.env.AUTOMATION_CONTROL_DB_HOST ?? process.env.BS_CONTROL_DB_HOST ?? '127.0.0.1',
  port: process.env.AUTOMATION_CONTROL_DB_PORT ?? process.env.BS_CONTROL_DB_PORT ?? '54329',
  database: process.env.AUTOMATION_CONTROL_DB_NAME ?? process.env.BS_CONTROL_DB_NAME ?? 'building_suit_control',
  user: process.env.AUTOMATION_CONTROL_DB_USER ?? process.env.BS_CONTROL_DB_USER ?? 'bs_control_app',
  sslmode: process.env.AUTOMATION_CONTROL_DB_SSLMODE ?? process.env.BS_CONTROL_DB_SSLMODE ?? 'prefer',
}

function liveCheck(check) {
  if (verificationProbe) {
    return
  }

  const values = {
    run_id: verificationRunId,
    name: check.name,
    status: check.status,
    exit_code: check.exit_code == null ? '' : String(check.exit_code),
    summary: check.summary ?? '',
    log_path: check.log_path ?? '',
    elapsed_ms: String(check.elapsed_ms ?? 0),
    command: check.command ?? '',
    required: check.required === false ? 'false' : 'true',
    metadata: JSON.stringify({
      verification_mode: verificationMode,
      selection_reason: check.selection_reason ?? 'unspecified',
      failure_class: check.failure_class ?? null,
      failure_evidence: check.failure_evidence ?? null,
    }),
  }
  const args = ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',controlDatabase.host,'-p',controlDatabase.port,'-U',controlDatabase.user,'-d',controlDatabase.database]
  for (const [key,value] of Object.entries(values)) args.push('--set',`${key}=${value}`)
  const result = executeWithControlDatabaseRetry(() => spawnSync('psql',args,{
    encoding:'utf8',
    env:{...process.env,PGSSLMODE:controlDatabase.sslmode},
    input:`SELECT control.update_verification_check(:'run_id'::bigint,:'name',:'status',NULLIF(:'exit_code','')::integer,:'summary',:'log_path',:'elapsed_ms'::bigint,:'command',:'required'::boolean,:'metadata'::jsonb);\n`,
  }), { successful: value => value.status === 0 && !value.error })
  if (result.status !== 0) {
    throw new Error(`live_verification_update_failed:${(result.stderr ?? '').trim()}`)
  }
}

mkdirSync(
  runDirectory,
  {
    recursive: true,
  },
)

function sanitizeName(value) {
  return value.replace(
    /[^a-zA-Z0-9._-]/g,
    '-',
  )
}

function runCheck({
  name,
  program,
  args = [],
  cwd = worktreePath,
  timeout = 15 * 60 * 1000,
  required = true,
  selectionReason = 'required_by_verification_policy',
}) {
  if(name==='ledger-shared-ui-tests')emptyComponentFixture(worktreePath,{name,summary:'ENOENT app/components'},true)
  if (suit.slug === 'shop-suit' && ['shop-database-regression', 'database-tests'].includes(name)) {
    const freshness = localShopMigrationReadiness({ worktreePath, changedFiles: [...changedFiles] })
    if (!freshness.ready) {
      const check = omittedCheck({
        name, command: `${program} ${args.join(' ')}`, required,
        reason: freshness.reason, unavailable: true,
        failureClass: freshness.failure_class,
        summary: `Local disposable database is not evidence for the current migration source: ${freshness.reason}; files: ${(freshness.files ?? []).join(', ')}`,
      })
      liveCheck(check)
      return check
    }
  }

  const started =
    Date.now()

  liveCheck({
    name,
    command: `${program} ${args.join(' ')}`,
    required,
    selection_reason: selectionReason,
    status: 'running',
    exit_code: null,
    summary: 'Running',
    log_path: null,
    elapsed_ms: 0,
  })

  const result =
    spawnSync(
      program,
      args,
      {
        cwd,
        encoding: 'utf8',

        env: {
          ...process.env,
          NO_COLOR: '1',
          FORCE_COLOR: '0',
          CI: '1',
        },

        timeout,

        maxBuffer:
          50 * 1024 * 1024,
      },
    )

  const stdout =
    result.stdout ?? ''

  const stderr =
    result.stderr ?? ''

  const exitCode =
    typeof result.status === 'number'
      ? result.status
      : 1

  const logPath =
    path.join(
      runDirectory,
      `${sanitizeName(name)}.log`,
    )

  writeFileSync(
    logPath,

    [
      `$ ${program} ${args.join(' ')}`,
      '',
      '--- STDOUT ---',
      stdout,
      '',
      '--- STDERR ---',
      stderr,
      '',
    ].join('\n'),

    {
      mode: 0o600,
    },
  )

  const unavailable =
    result.error?.code === 'ENOENT'

  const passed =
    exitCode === 0 &&
    !result.error

  const combined =
    `${stdout}\n${stderr}`
      .trim()

  const lines =
    combined
      .split('\n')
      .filter(Boolean)

  const summary =
    unavailable
      ? `Required program is unavailable: ${program}`
      : passed
      ? `PASS in ${Date.now() - started}ms`
      : (
          lines
            .slice(-20)
            .join('\n')
            .slice(0, 4000) ||
          result.error?.message ||
          'Command failed'
        )

  const missingEvidence = required && requiredVerificationEvidenceMissing({ name, output: combined })
  const check = {
    name,
    command:
      `${program} ${args.join(' ')}`,
    required,
    selection_reason: selectionReason,
    status:
      missingEvidence ? 'not_run' : commandResultStatus({
        required,
        exitCode,
        errorCode: result.error?.code,
      }),
    failure_class:
      verificationCommandFailureClass({
        name, required, passed, errorCode: result.error?.code, signal: result.signal, output: combined, missingEvidence,
      }),
    exit_code:
      exitCode,
    summary: missingEvidence ? 'Required HTTP coverage did not execute all checks; disposable fixture evidence is still required.\n' + summary : summary,
    log_path:
      logPath,
    elapsed_ms:
      Date.now() - started,
  }

  check.failure_evidence=failureEvidence({execution_id:null,verification_run_id:verificationRunId,check,artifact:readFileSync(logPath,'utf8'),classification:processFailureCategory(result,missingEvidence),phase:result.error?'spawn':'test',origin:result.error?'process':'unknown',result:{signal:result.signal??null,error_code:result.error?.code??null}})
  liveCheck(check)

  return check
}

function gitOutput(args) {
  const result =
    spawnSync(
      'git',
      args,
      {
        cwd:
          worktreePath,
        encoding:
          'utf8',
      },
    )

  if (result.status !== 0) {
    fail(
      `git ${args.join(' ')} failed`,
    )
  }

  return (
    result.stdout ?? ''
  ).trim()
}

const changedFiles =
  new Set()

const verificationBaseSha =
  gitOutput(['rev-parse', 'HEAD'])

for (
  const output
  of [
    gitOutput([
      'diff',
      '--name-only',
      'HEAD',
    ]),

    gitOutput([
      'diff',
      '--cached',
      '--name-only',
    ]),

    gitOutput([
      'ls-files',
      '--others',
      '--exclude-standard',
    ]),
  ]
) {
  for (
    const file
    of output
      .split('\n')
      .filter(Boolean)
  ) {
    changedFiles.add(file)
  }
}

const verificationPlanText =
  JSON.stringify(
    task.verification_plan ?? [],
  )
    .toLowerCase()

const results = []

function omittedCheck({
  name,
  command,
  required = false,
  reason,
  summary,
  unavailable = false,
  failureClass = null,
}) {
  return {
    name,
    command,
    required,
    selection_reason: reason,
    status:
      unavailable && required
        ? 'not_run'
        : 'skipped',
    failure_class: failureClass,
    exit_code: null,
    summary,
    log_path: null,
    elapsed_ms: 0,
  }
}

results.push(
  runCheck({
    name:
      'dependencies',

    program:
      'pnpm',

    args: [
      'install',
      '--frozen-lockfile',
      '--prefer-offline',
    ],

    timeout:
      20 * 60 * 1000,

    selectionReason:
      'verification_environment_prerequisite',
  }),
)

results.push(
  runCheck({
    name:
      'git-diff-check',

    program:
      'git',

    args: [
      'diff',
      '--check',
    ],

    selectionReason:
      'required_for_changed_files',
  }),
)

const rootLintSelection =
  controlPlaneRootLintSelection({
    changedFiles: [...changedFiles],
  })

if (rootLintSelection.selected) {
  results.push(
    runCheck({
      name:
        'root-lint',

      program:
        'pnpm',

      args: [
        'lint',
      ],

      selectionReason:
        rootLintSelection.reason,
    }),
  )
}

if (
  isMilestoneVerification(verificationMode) ||
  /pnpm check|workspace check/.test(verificationPlanText)
) {
  results.push(
    runCheck({
      name:
        'workspace-check',

      program:
        'pnpm',

      args: [
        'check',
      ],

      selectionReason:
        isMilestoneVerification(verificationMode)
          ? 'required_by_milestone_contract'
          : 'required_by_task_verification_plan',
    }),
  )
}

const appPath =
  workstream.application_path ??
  suit.app_path

const appPackagePath =
  appPath
    ? path.join(
        worktreePath,
        appPath,
        'package.json',
      )
    : null

let appPackage = null

if (
  appPackagePath &&
  existsSync(appPackagePath)
) {
  appPackage =
    JSON.parse(
      readFileSync(
        appPackagePath,
        'utf8',
      ),
    )
}

const applicationSelection =
  applicationScopeSelected({
    appPath,
    changedFiles: [...changedFiles],
    mode: verificationMode,
    verificationPlanText,
  })

if (
  appPackage?.name &&
  applicationSelection.selected
) {
  if (
    appPackage.scripts?.typecheck
  ) {
    results.push(
      runCheck({
        name:
          'app-typecheck',

        program:
          'pnpm',

        args: [
          '--filter',
          appPackage.name,
          'typecheck',
        ],

        selectionReason:
          applicationSelection.reason,
      }),
    )
  }

  if (
    appPackage.scripts?.lint
  ) {
    results.push(
      runCheck({
        name:
          'app-lint',

        program:
          'pnpm',

        args: [
          '--filter',
          appPackage.name,
          'lint',
        ],

        selectionReason:
          applicationSelection.reason,
      }),
    )
  }

  if (
    appPackage.scripts?.['test:unit']
  ) {
    results.push(
      runCheck({
        name:
          'app-unit',

        program:
          'pnpm',

        args: [
          '--filter',
          appPackage.name,
          'test:unit',
        ],

        selectionReason:
          applicationSelection.reason,
      }),
    )
  }

  const buildRequired =
    [
      'feature',
      'bug',
      'database',
    ].includes(
      task.task_type,
    ) ||
    [
      'high',
      'critical',
    ].includes(
      task.risk_level,
    ) ||
    verificationPlanText.includes(
      'build',
    )

  if (
    buildRequired &&
    appPackage.scripts?.build
  ) {
    results.push(
      runCheck({
        name:
          'app-build',

        program:
          'pnpm',

        args: [
          '--filter',
          appPackage.name,
          'build',
        ],

        timeout:
          20 * 60 * 1000,

        selectionReason:
          applicationSelection.reason,
      }),
    )
  }
}

for (const custom of verificationConfig.commands ?? []) {
  if (!safeRegisteredVerificationCommand(custom)) {
    results.push(omittedCheck({
      name: custom?.name ?? `invalid-registered-command-${results.length + 1}`,
      command: null,
      required: custom?.required !== false,
      reason: 'registered_verification_command_invalid',
      summary: 'Registered verification command must use a safe program/argv definition and repository-relative cwd.',
      unavailable: true,
      failureClass: 'verification-configuration',
    }))
    continue
  }
  const selection = customCheckSelection({
    check: custom,
    changedFiles: [...changedFiles],
    mode: verificationMode,
    verificationPlanText,
  })
  if (!selection.selected) {
    results.push(omittedCheck({
      name: custom.name,
      command: [custom.program, ...(custom.args ?? [])].join(' '),
      required: custom.required !== false,
      reason: selection.reason,
      summary: 'No changed file matched this focused custom check.',
    }))
    continue
  }
  results.push(runCheck({
    name: custom.name,
    program: custom.program,
    args: custom.args ?? [],
    cwd: custom.cwd ? path.join(worktreePath, custom.cwd) : worktreePath,
    timeout: custom.timeout_ms ?? 15 * 60 * 1000,
    required: custom.required !== false,
    selectionReason: selection.reason,
  }))
}

const changed =
  [...changedFiles]

const databaseChanged =
  appPath &&
  changed.some(
    file =>
      file.startsWith(
        `${appPath}/supabase/`,
      ),
  )

const changedDatabaseTests =
  appPath
    ? changed
        .filter(
          file =>
            file.startsWith(
              `${appPath}/supabase/tests/`,
            ) &&
            /\.(?:sql|pg)$/.test(
              file,
            ),
        )
        .map(
          file =>
            path
              .relative(
                appPath,
                file,
              )
              .split(
                path.sep,
              )
              .join('/'),
        )
    : []

if (databaseChanged) {
  const databaseVerification = resolveDatabaseVerification({
    verificationConfig,
    suitSlug: suit.slug,
    appPath,
    changedDatabaseTests,
  })

  if (databaseVerification.commands.length === 0) {
    results.push(omittedCheck({
      name: 'database-tests',
      command: null,
      required: true,
      reason: 'required_database_runner_unavailable',
      summary: databaseVerification.source === 'invalid_configuration'
        ? `The registered database verification command for ${suit.slug} is invalid.`
        : `No registered database verification command is configured for ${suit.slug}.`,
      unavailable: true,
      failureClass: 'verification-configuration',
    }))
  }
  else {
    for (const command of databaseVerification.commands) {
      // A failed prerequisite makes later database evidence unavailable rather
      // than executing against an unprepared local database.
      const prerequisiteFailed = results.some(result =>
        result.database_phase && result.status !== 'pass',
      )
      if (prerequisiteFailed) {
        results.push(omittedCheck({
          name: command.name,
          command: [command.program, ...(command.args ?? [])].join(' '),
          required: command.required !== false,
          reason: 'database_prerequisite_failed',
          summary: 'Database verification prerequisite failed.',
          unavailable: true,
          failureClass: 'verification-infrastructure',
        }))
        continue
      }
      const databaseResult = runCheck({
        name: command.name,
        program: command.program,
        args: command.args ?? [],
        cwd: command.cwd ? path.join(worktreePath, command.cwd) : worktreePath,
        timeout: command.timeout_ms ?? 15 * 60 * 1000,
        required: command.required !== false,
        selectionReason: databaseVerification.source.startsWith('registered_')
          ? 'registered_database_verification_contract'
          : 'database_scope_changed',
      })
      databaseResult.database_phase = command.phase ?? 'test'
      results.push(databaseResult)
    }

    if (
      databaseVerification.source === 'legacy_ledger_compatibility' &&
      changedDatabaseTests.length === 0
    ) {
      results.push(omittedCheck({
        name: 'database-tests',
        command: null,
        required: true,
        reason: 'required_database_test_unavailable',
        summary: 'Ledger database changed but this task changed no task-specific pgTAP test.',
        unavailable: true,
        failureClass: 'verification-configuration',
      }))
    }
  }
}

const explicitBrowserChecks = resolvedPlan.checks.filter(check =>
  Array.isArray(check.capabilities) && check.capabilities.includes('browser'),
)

const browserRequired =
  explicitBrowserChecks.length === 0 &&
  /e2e|browser|playwright/.test(
    verificationPlanText,
  )


const changedBrowserTests =
  appPath
    ? changed
        .filter(
          file =>
            file.startsWith(
              `${appPath}/tests/e2e/`,
            ) &&
            /\.spec\.(?:ts|js|mjs)$/.test(
              file,
            ),
        )
        .map(
          file =>
            path
              .relative(
                appPath,
                file,
              )
              .split(
                path.sep,
              )
              .join('/'),
        )
    : []


let browserEnvironmentReady =
  true


if (
  browserRequired &&
  suit.slug === 'ledger-suit'
) {

  const browserDatabaseReset =
    runCheck({
      name:
        'browser-database-reset',

      program:
        'pnpm',

      args: [
        'exec',
        'supabase',
        '--workdir',
        'apps/ledger-suit',
        'db',
        'reset',
        '--local',
      ],

    timeout:
      15 * 60 * 1000,

    selectionReason:
      'required_browser_environment',
    })


  results.push(
    browserDatabaseReset,
  )


  browserEnvironmentReady =
    browserDatabaseReset.status ===
    'pass'
}

if (browserRequired) {

  if (
   browserEnvironmentReady &&
   appPackage?.name &&
   (
     changedBrowserTests.length > 0 ||
     isMilestoneVerification(verificationMode)
   )
  ) {

    results.push(
      runCheck({
        name:
          'browser-tests',

        program:
          'pnpm',

        args: [
          '--filter',
          appPackage.name,

          'exec',
          'playwright',
          'test',

          ...changedBrowserTests,

          '--workers=1',
          '--retries=0',
          '--repeat-each=2',
        ],

        timeout:
          12 * 60 * 1000,

        selectionReason:
          changedBrowserTests.length > 0
            ? 'changed_browser_spec'
            : 'required_by_milestone_contract',
      }),
    )

  }
  else {

    results.push(omittedCheck({
      name: 'browser-tests',
      command: null,
      required: true,
      reason: appPackage?.name
        ? 'required_browser_check_has_no_changed_spec'
        : 'required_browser_runner_unavailable',
      summary: appPackage?.name
        ? 'Browser verification is required, but no task-specific Playwright spec changed in focused mode.'
        : `Browser verification is required, but ${appPath ?? suit.slug} has no runnable application package.`,
      unavailable: true,
    }))

  }

}

for (const planned of resolvedPlan.checks) {
  const existing = results.find(result =>
    result.name === planned.name && result.status !== 'skipped',
  )
  if (existing) continue

  results.push(runCheck({
    name: planned.name,
    program: planned.program,
    args: planned.args,
    cwd: planned.cwd ? path.join(worktreePath, planned.cwd) : worktreePath,
    timeout: planned.timeout_ms ?? 15 * 60 * 1000,
    required: true,
    selectionReason: 'required_by_task_verification_plan',
  }))
}

function existingResult(...names) {
  return results.find(result => names.includes(result.name))
}

function plannedCompatibilityCovered(blocker) {
  if (blocker.kind !== 'planned_test') return false

  if (['generator_disposable_fixture_runner_not_registered','missing_generated_fixture_boundary_runner','future_generator_fixture_not_implemented'].includes(blocker.blocker)) {
    const fixture = 'tooling/new-platform/verify-fixture.mjs'
    if (!existsSync(path.join(worktreePath, fixture))) return false
    results.push(runCheck({name: `verification-obligation-blocked-${results.length + 1}`, program:'node', args:[fixture], required:true, selectionReason:'planned_test_materialized_as_executable'}))
    return true
  }

  if (blocker.blocker==='missing_strict_boundary_runner' && blocker.plan_entry==='node tooling/checks/suit-template-boundaries.mjs --require-strict') {
    const runner='tooling/checks/suit-template-boundaries.mjs'
    if(!existsSync(path.join(worktreePath,runner))) return false
    results.push(runCheck({name:`verification-obligation-blocked-${results.length+1}`,program:'node',args:[runner,'--require-strict'],required:true,selectionReason:'existing_strict_boundary_binding_reconciled'}))
    return true
  }

  if (blocker.blocker === 'missing_suit_template_boundary_runner') {
    const match = String(blocker.plan_entry).match(
      /^node\s+([A-Za-z0-9._/-]+\.(?:mjs|js))$/,
    )
    if (!match || match[1].split('/').includes('..')) return false

    const relativePath = match[1]
    if (!existsSync(path.join(worktreePath, relativePath))) return false

    results.push(runCheck({
      name: 'suit-template-boundaries',
      program: 'node',
      args: [relativePath],
      required: blocker.required !== false,
      selectionReason: 'planned_test_materialized_as_executable',
    }))
    return true
  }

  if (blocker.blocker === 'shop_storage_policy_coverage_not_implemented') {
    if (changedDatabaseTests.length === 0) return false
    return Boolean(existingResult('shop-database-regression', 'database-tests'))
  }

  if (blocker.blocker === 'shop_storage_http_signed_url_coverage_not_implemented') {
    if (!appPath) return false
    const relativePath =
      `${appPath}/tests/integration/payment-evidence-http.mjs`
    if (!existsSync(path.join(worktreePath, relativePath))) return false

    results.push(runCheck({
      name: 'shop-payment-evidence-http',
      program: 'node',
      args: ['--test', '--test-reporter=tap', relativePath],
      required: blocker.required !== false,
      selectionReason: 'planned_test_materialized_as_executable',
    }))
    return true
  }

  if (blocker.blocker === 'super_admin_app_and_local_database_not_present') {
    return Boolean(existingResult('super-admin-database-reset'))
  }

  if (blocker.blocker === 'super_admin_security_database_tests_not_present') {
    return Boolean(existingResult('super-admin-database-tests'))
  }

  if (blocker.blocker === 'super_admin_generated_type_check_not_present') {
    if (!appPath) return false
    const typeFile =
      path.join(worktreePath, appPath, 'app', 'types', 'database.types.ts')
    if (!existsSync(typeFile)) return false

    results.push(runCheck({
      name: 'super-admin-generated-types',
      program: 'node',
      args: [new URL('./check-generated-types.mjs', import.meta.url).pathname, typeFile, path.join(runDirectory, 'super-admin-generated-types.expected.ts')],
      cwd: path.join(worktreePath, appPath),
      timeout: 5 * 60 * 1000,
      required: blocker.required !== false,
      selectionReason: 'planned_test_materialized_as_executable',
    }))
    return true
  }

  return false
}

for (const blocker of resolvedPlan.blockers) {
  if (plannedCompatibilityCovered(blocker)) continue

  const failureClass =
    blocker.kind === 'planned_test'
      ? 'verification-product-defect'
      : blocker.kind === 'external_gate'
        ? 'verification-required-check-unavailable'
        : 'verification-configuration'

  results.push(omittedCheck({
    name: `verification-obligation-blocked-${results.length + 1}`,
    command: null,
    required: blocker.required !== false,
    reason: blocker.blocker,
    summary: `Required verification obligation is blocked (${blocker.kind}): ${blocker.plan_entry}`,
    unavailable: true,
    failureClass,
  }))
}

for (const entry of resolvedPlan.unenforced) {
  results.push(omittedCheck({
    name: `verification-plan-unenforced-${results.length + 1}`,
    command: null,
    required: true,
    reason: 'verification_plan_entry_unenforced',
    summary: `Required verification-plan entry is not a known safe check or registered command: ${entry}`,
    unavailable: true,
    failureClass: 'verification-configuration',
  }))
}

const passed =
  results.every(
    result =>
      result.status === 'pass' ||
      result.status === 'skipped',
  )

const verifiedFiles = [...changedFiles].sort().map(file => ({
  file,
  object: existsSync(path.join(worktreePath, file))
    ? gitOutput(['hash-object', '--', file])
    : 'deleted',
}))

const verifiedState = {
  base_sha: verificationBaseSha,
  files: verifiedFiles,
}

verifiedState.fingerprint =
  publicationStateFingerprint(verifiedState)

const classification =
  classifyVerificationResults(results)

process.stdout.write(
  `${JSON.stringify({
    ok: true,

    passed,

    classification,

    task_id:
      task.task_id,

    verification_mode:
      verificationMode,

    changed_files:
      changed,

    verified_state:
      verifiedState,

    checks:
      results,
  })}\n`,
)
