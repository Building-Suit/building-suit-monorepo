#!/usr/bin/env node

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

const [
  worktreePath,
  packetPath,
  runDirectory,
  verificationRunId,
] = process.argv.slice(2)

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
  !/^\d+$/.test(verificationRunId ?? '')
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
const verificationConfig = {
  ...(project.verification_config ?? {}),
  ...(workstream.verification_config ?? {}),
}

const controlDatabase = {
  host: process.env.AUTOMATION_CONTROL_DB_HOST ?? process.env.BS_CONTROL_DB_HOST ?? '127.0.0.1',
  port: process.env.AUTOMATION_CONTROL_DB_PORT ?? process.env.BS_CONTROL_DB_PORT ?? '54329',
  database: process.env.AUTOMATION_CONTROL_DB_NAME ?? process.env.BS_CONTROL_DB_NAME ?? 'building_suit_control',
  user: process.env.AUTOMATION_CONTROL_DB_USER ?? process.env.BS_CONTROL_DB_USER ?? 'bs_control_app',
  sslmode: process.env.AUTOMATION_CONTROL_DB_SSLMODE ?? process.env.BS_CONTROL_DB_SSLMODE ?? 'prefer',
}

function liveCheck(check) {
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
  }
  const args = ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',controlDatabase.host,'-p',controlDatabase.port,'-U',controlDatabase.user,'-d',controlDatabase.database]
  for (const [key,value] of Object.entries(values)) args.push('--set',`${key}=${value}`)
  const result = spawnSync('psql',args,{
    encoding:'utf8',
    env:{...process.env,PGSSLMODE:controlDatabase.sslmode},
    input:`SELECT control.update_verification_check(:'run_id'::bigint,:'name',:'status',NULLIF(:'exit_code','')::integer,:'summary',:'log_path',:'elapsed_ms'::bigint,:'command',:'required'::boolean);\n`,
  })
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
}) {
  const started =
    Date.now()

  liveCheck({
    name,
    command: `${program} ${args.join(' ')}`,
    required,
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
    passed
      ? `PASS in ${Date.now() - started}ms`
      : (
          lines
            .slice(-20)
            .join('\n')
            .slice(0, 4000) ||
          result.error?.message ||
          'Command failed'
        )

  const check = {
    name,
    command:
      `${program} ${args.join(' ')}`,
    required,
    status:
      passed
        ? 'pass'
        : (
            required
              ? 'fail'
              : 'skipped'
          ),
    exit_code:
      exitCode,
    summary,
    log_path:
      logPath,
    elapsed_ms:
      Date.now() - started,
  }

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
  }),
)

results.push(
  runCheck({
    name:
      'workspace-check',

    program:
      'pnpm',

    args: [
      'check',
    ],
  }),
)

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

if (appPackage?.name) {
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
      }),
    )
  }
}
else {
  results.push(
    runCheck({
      name:
        'root-typecheck',

      program:
        'pnpm',

      args: [
        'typecheck',
      ],
    }),
  )
}

for (const custom of verificationConfig.commands ?? []) {
  const prefixes = Array.isArray(custom.changed_paths) ? custom.changed_paths : []
  if (prefixes.length > 0 && ![...changedFiles].some(file => prefixes.some(prefix => file.startsWith(prefix)))) {
    results.push({
      name: custom.name,
      command: [custom.program, ...(custom.args ?? [])].join(' '),
      required: custom.required !== false,
      status: 'skipped',
      exit_code: null,
      summary: 'No changed file matched this custom check.',
      log_path: null,
      elapsed_ms: 0,
    })
    continue
  }
  results.push(runCheck({
    name: custom.name,
    program: custom.program,
    args: custom.args ?? [],
    cwd: custom.cwd ? path.join(worktreePath, custom.cwd) : worktreePath,
    timeout: custom.timeout_ms ?? 15 * 60 * 1000,
    required: custom.required !== false,
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

  if (
    suit.slug === 'ledger-suit'
  ) {

    const ledgerAppPath =
      path.join(
        worktreePath,
        appPath,
      )


    const databaseReset =
      runCheck({
        name:
          'database-reset',

        program:
          'pnpm',

        args: [
          'exec',
          'supabase',
          'db',
          'reset',
          '--local',
        ],

        cwd:
          ledgerAppPath,

        timeout:
          20 * 60 * 1000,
      })


    results.push(
      databaseReset,
    )


    if (
      databaseReset.status === 'pass'
    ) {

      if (
        changedDatabaseTests.length > 0
      ) {

        results.push(
          runCheck({
            name:
              'database-tests',

            program:
              'pnpm',

            args: [
              'exec',
              'supabase',
              'test',
              'db',

              ...changedDatabaseTests,

              '--local',
            ],

            cwd:
              ledgerAppPath,

            timeout:
              15 * 60 * 1000,
          }),
        )

      }
      else {

        results.push({
          name:
            'database-tests',

          command:
            null,

          required:
            true,

          status:
            'not_run',

          exit_code:
            null,

          summary:
            'Ledger database changed but this task changed no task-specific pgTAP test.',

          log_path:
            null,

          elapsed_ms:
            0,
        })

      }

    }

  }
  else if (
    suit.slug === 'shop-suit'
  ) {

    results.push(
      runCheck({
        name:
          'database-tests',

        program:
          'pnpm',

        args: [
          'db:test:shop',
        ],

        timeout:
          30 * 60 * 1000,
      }),
    )

  }
  else {

    results.push({
      name:
        'database-tests',

      command:
        null,

      required:
        true,

      status:
        'not_run',

      exit_code:
        null,

      summary:
        `No database verification command configured for ${suit.slug}.`,

      log_path:
        null,

      elapsed_ms:
        0,
    })

  }

}

const browserRequired =
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
   changedBrowserTests.length > 0
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
          '--max-failures=1',
        ],

        timeout:
          12 * 60 * 1000,
      }),
    )

  }
  else {

    results.push({
      name:
        'browser-tests',

      command:
        null,

      required:
        false,

      status:
        'skipped',

      exit_code:
        null,

      summary:
        'No task-specific Playwright spec was changed; broad application E2E suite intentionally skipped.',

      log_path:
        null,

      elapsed_ms:
        0,
    })

  }

}

const passed =
  results.every(
    result =>
      result.status === 'pass' ||
      result.status === 'skipped',
  )

process.stdout.write(
  `${JSON.stringify({
    ok: true,

    passed,

    task_id:
      task.task_id,

    changed_files:
      changed,

    checks:
      results,
  })}\n`,
)
