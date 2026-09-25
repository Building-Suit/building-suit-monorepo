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
  !runDirectory
) {
  fail(
    'worktree, packet and run directory are required',
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

  return {
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

if (databaseChanged) {

  if (
    suit.slug === 'ledger-suit'
  ) {

    results.push(
      runCheck({
        name:
          'database-reset',

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
          20 * 60 * 1000,
      }),
    )


    if (
      results.at(-1)?.status ===
      'pass'
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
            '--workdir',
            'apps/ledger-suit',
            'test',
            'db',
            '--local',
          ],

          timeout:
            30 * 60 * 1000,
        }),
      )

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
