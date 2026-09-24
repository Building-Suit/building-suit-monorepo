#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  rmSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getProfile,
  listProfiles,
  resolveProfile,
} from '../routing/router.mjs'

const automationCodexHome =
  process.env.BS_CODEX_HOME ??
  path.join(
    os.homedir(),
    'Services',
    'building-suit-monorepo-plane',
    'codex-home',
  )

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

const githubRepository = 'Building-Suit/building-suit-monorepo'

const [command, ...args] = process.argv.slice(2)

function execute(program, programArgs = [], options = {}) {
  const childEnv = {
    ...process.env,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    ...(options.env ?? {}),
  }

  for (const variable of options.unsetEnv ?? []) {
    delete childEnv[variable]
  }

	const result = spawnSync(program, programArgs, {
	  cwd: options.cwd ?? repoRoot,
	  encoding: 'utf8',

	  env: {
	    ...process.env,
	    NO_COLOR: '1',
	    FORCE_COLOR: '0',
	    ...(options.env ?? {}),
	  },

	  input: options.input,

	  timeout: options.timeout,

	  maxBuffer:
	    options.maxBuffer ??
	    50 * 1024 * 1024,
	})

  return {
    code:
      typeof result.status === 'number'
        ? result.status
        : 1,

    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),

    error:
      result.error
        ? result.error.message
        : null,
  }
}

function output(payload, exitCode = 0) {
  process.stdout.write(
    `${JSON.stringify(payload, null, 2)}\n`,
  )

  process.exitCode = exitCode
}

function successful(result) {
  return result.code === 0 && !result.error
}

function git(programArgs) {
  return execute('git', programArgs)
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text)
  }
  catch {
    return fallback
  }
}

function parseWorktrees(text) {
  if (!text.trim()) {
    return []
  }

  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const entry = {}

      for (const line of block.split('\n')) {
        if (line.startsWith('worktree ')) {
          entry.path = line.slice('worktree '.length)
        }
        else if (line.startsWith('HEAD ')) {
          entry.head = line.slice('HEAD '.length)
        }
        else if (line.startsWith('branch ')) {
          entry.branch = line
            .slice('branch '.length)
            .replace(/^refs\/heads\//, '')
        }
        else if (line === 'detached') {
          entry.detached = true
        }
        else if (line === 'prunable') {
          entry.prunable = true
        }
      }

      return entry
    })
}

function getToolVersion(program, versionArgs = ['--version']) {
  const result = execute(program, versionArgs)

  return {
    available: successful(result),
    version:
      successful(result)
        ? result.stdout.split('\n')[0]
        : null,
  }
}

function ping() {
  const branchResult = git([
    'branch',
    '--show-current',
  ])

  const headResult = git([
    'rev-parse',
    'HEAD',
  ])

  output({
    ok: true,
    command: 'ping',
    repo_root: repoRoot,

    git: {
      branch:
        successful(branchResult)
          ? branchResult.stdout
          : null,

      head_sha:
        successful(headResult)
          ? headResult.stdout
          : null,
    },

    tools: {
      node: {
        available: true,
        version: process.version,
      },

      git: getToolVersion('git'),
      gh: getToolVersion('gh'),
    },
  })
}

function repoState() {
  const fetchResult = git([
    'fetch',
    'origin',
    '--prune',
  ])

  if (!successful(fetchResult)) {
    output({
      ok: false,
      command: 'repo-state',
      stage: 'git-fetch',
      error:
        fetchResult.stderr ||
        fetchResult.error ||
        'git fetch failed',
    }, fetchResult.code || 1)

    return
  }

  const branchResult = git([
    'branch',
    '--show-current',
  ])

  const headResult = git([
    'rev-parse',
    'HEAD',
  ])

  const stgResult = git([
    'rev-parse',
    'origin/stg',
  ])

  const statusResult = git([
    'status',
    '--short',
  ])

  const worktreeResult = git([
    'worktree',
    'list',
    '--porcelain',
  ])

  const openPrResult = execute('gh', [
    'pr',
    'list',
    '--repo',
    githubRepository,
    '--state',
    'open',
    '--limit',
    '100',
    '--json',
    [
      'number',
      'title',
      'headRefName',
      'baseRefName',
      'isDraft',
      'state',
      'url',
    ].join(','),
  ])

  if (!successful(openPrResult)) {
    output({
      ok: false,
      command: 'repo-state',
      stage: 'github-pr-list',
      error:
        openPrResult.stderr ||
        openPrResult.error ||
        'gh pr list failed',
    }, openPrResult.code || 1)

    return
  }

  output({
    ok: true,
    command: 'repo-state',

    repository: githubRepository,
    repo_root: repoRoot,

    current: {
      branch:
        successful(branchResult)
          ? branchResult.stdout
          : null,

      head_sha:
        successful(headResult)
          ? headResult.stdout
          : null,

      origin_stg_sha:
        successful(stgResult)
          ? stgResult.stdout
          : null,

      dirty_files:
        successful(statusResult) && statusResult.stdout
          ? statusResult.stdout.split('\n')
          : [],
    },

    worktrees:
      successful(worktreeResult)
        ? parseWorktrees(worktreeResult.stdout)
        : [],

    open_pull_requests:
      parseJson(openPrResult.stdout, []),
  })
}

function preflight() {
  const result = execute(
    process.execPath,
    [
      'tooling/git/preflight.mjs',
    ],
  )

  output({
    ok: successful(result),
    command: 'preflight',
    exit_code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  }, result.code)
}

function prCheck() {
  const [prNumber] = args

  if (!prNumber || !/^[1-9][0-9]*$/.test(prNumber)) {
    output({
      ok: false,
      command: 'pr-check',
      error: 'A positive numeric PR number is required.',
    }, 64)

    return
  }

  const result = execute(
    process.execPath,
    [
      'tooling/git/check-pr.mjs',
      prNumber,
    ],
  )

  output({
    ok: successful(result),
    command: 'pr-check',
    pr_number: Number(prNumber),
    exit_code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  }, result.code)
}

const codexCredentialEnvironmentVariables = [
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
  'CODEX_ACCESS_TOKEN',
  'OPENAI_IDENTITY_TOKEN_FILE',
]

function codexExecutionOptions(extra = {}) {
  return {
    ...extra,

    env: {
      ...(extra.env ?? {}),

      // Keep automated Building Suit runs isolated from the
      // developer's personal Codex plugins, MCP servers and config.
      CODEX_HOME: automationCodexHome,
    },

    unsetEnv: [
      ...codexCredentialEnvironmentVariables,
      ...(extra.unsetEnv ?? []),
    ],
  }
}

function discoverCodexModels() {
  const result = execute(
    process.execPath,
    [
      'tooling/control-plane/runner/codex-models.mjs',
    ],
    codexExecutionOptions({
      timeout: 20_000,
    }),
  )

  if (!successful(result)) {
    throw new Error(
      [
        'Codex model discovery failed.',
        result.stderr,
        result.error,
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  let models

  try {
    models = JSON.parse(result.stdout)
  }
  catch {
    throw new Error(
      'Codex model discovery returned invalid JSON.',
    )
  }

  if (
    !Array.isArray(models) ||
    models.length === 0
  ) {
    throw new Error(
      'Codex returned no available models.',
    )
  }

  return models
}

function resolveCodexRoute(profile) {
  const models = discoverCodexModels()

  return resolveProfile(
    profile,
    models,
  )
}

function codexStatus() {
  const version = execute(
    'codex',
    ['--version'],
    codexExecutionOptions(),
  )

  if (!successful(version)) {
    output({
      ok: false,
      command: 'codex-status',
      error: 'codex_not_available',
      details:
        version.stderr ||
        version.error ||
        version.stdout,
    }, 1)

    return
  }

  const login = execute(
    'codex',
    [
      'login',
      'status',
    ],
    codexExecutionOptions(),
  )

  const loginOutput = [
    login.stdout,
    login.stderr,
  ]
    .filter(Boolean)
    .join('\n')

  const usingChatGPT =
    login.code === 0 &&
    loginOutput.includes('Logged in using ChatGPT')

  const parentCredentialEnvironment =
    Object.fromEntries(
      codexCredentialEnvironmentVariables.map(
        variable => [
          variable,
          Boolean(process.env[variable]),
        ],
      ),
    )

  output({
    ok: usingChatGPT,

    command: 'codex-status',

    version: version.stdout,

    authentication: {
      chatgpt: usingChatGPT,

      status:
        usingChatGPT
          ? 'chatgpt'
          : 'unsupported_or_missing',

      raw_status: loginOutput,
    },

    api_credentials: {
      inherited_environment:
        parentCredentialEnvironment,

      stripped_for_codex_runs:
        codexCredentialEnvironmentVariables,
    },
  }, usingChatGPT ? 0 : 1)
}

function routeProfile() {
  const [profile] = args

  if (!profile) {
    output({
      ok: false,
      command: 'route',
      error: 'profile_required',
      allowed_profiles: listProfiles(),
    }, 64)

    return
  }

  try {
    const requested = getProfile(profile)

    const resolved =
      requested.uses_codex
        ? resolveCodexRoute(profile)
        : resolveProfile(profile, [])

    output({
      ok: true,
      command: 'route',
      route: resolved,
    })
  }
  catch (error) {
    output({
      ok: false,
      command: 'route',
      error: error.message,
      allowed_profiles: listProfiles(),
    }, 1)
  }
}

function codexSmoke() {
  const [profile = 'fast'] = args

  let route

  try {
    route = resolveCodexRoute(profile)
  }
  catch (error) {
    output({
      ok: false,
      command: 'codex-smoke',
      error: error.message,
    }, 64)

    return
  }

  if (!route.uses_codex) {
    output({
      ok: false,
      command: 'codex-smoke',
      error: 'profile_does_not_use_codex',
      profile,
    }, 64)

    return
  }

  const login = execute(
    'codex',
    [
      'login',
      'status',
    ],
    codexExecutionOptions(),
  )

  const loginOutput = [
    login.stdout,
    login.stderr,
  ]
    .filter(Boolean)
    .join('\n')

  if (
    login.code !== 0 ||
    !loginOutput.includes('Logged in using ChatGPT')
  ) {
    output({
      ok: false,
      command: 'codex-smoke',
      error: 'chatgpt_authentication_required',
    }, 1)

    return
  }

  const temporaryDirectory = mkdtempSync(
    path.join(
      os.tmpdir(),
      'building-suit-codex-smoke-',
    ),
  )

  const startedAt = Date.now()

  try {
    const result = execute(
      'codex',
      [
        'exec',

        '--json',
        '--ephemeral',

        '--skip-git-repo-check',

        '--sandbox',
        'read-only',

        '-C',
        temporaryDirectory,

        '--model',
        route.model,

        '-c',
        `model_reasoning_effort="${route.reasoning_effort}"`,

        [
          'This is a Building Suit control-plane readiness probe.',
          'Do not inspect files.',
          'Do not execute shell commands.',
          'Do not use tools.',
          'Respond with exactly: CODEX_SMOKE_OK',
        ].join(' '),
      ],
      codexExecutionOptions({
        cwd: temporaryDirectory,
      }),
    )

    const elapsedMs = Date.now() - startedAt

    const markerPresent =
      result.stdout.includes('CODEX_SMOKE_OK')

    const ok =
      successful(result) &&
      markerPresent

    const eventCount =
      result.stdout
        .split('\n')
        .filter(Boolean)
        .length

    output({
      ok,

      command: 'codex-smoke',

      route: {
        profile: route.profile,
        model: route.model,
        reasoning_effort:
          route.reasoning_effort,
      },

      execution: {
        exit_code: result.code,
        elapsed_ms: elapsedMs,
        jsonl_event_count: eventCount,
        marker_present: markerPresent,
      },

      stderr:
        result.stderr
          ? result.stderr.slice(0, 4000)
          : '',
    }, ok ? 0 : result.code || 1)
  }
  finally {
    rmSync(
      temporaryDirectory,
      {
        recursive: true,
        force: true,
      },
    )
  }
}

switch (command) {
  case 'ping':
    ping()
    break

  case 'repo-state':
    repoState()
    break

  case 'preflight':
    preflight()
    break

  case 'pr-check':
    prCheck()
    break

  case 'codex-status':
    codexStatus()
    break

  case 'route':
    routeProfile()
    break

  case 'codex-smoke':
    codexSmoke()
    break

  default:
    output({
      ok: false,
      error: 'unknown_command',
      allowed_commands: [
        'ping',
        'repo-state',
        'preflight',
        'pr-check <number>',
        'codex-status',
        'route <profile>',
        'codex-smoke <profile>',
      ],
    }, 64)
}
