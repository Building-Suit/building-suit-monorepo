#!/usr/bin/env node
import { cleanupIntegratedWorktrees } from './dot-cleanup.mjs'
import { strictBindingRecoveryEvidence, requiresSameAttemptVerification } from './binding-recovery.mjs'
import { incidentIdentity, repairEvidenceHeader, parentContinuation, effectiveFailureClass, workerProcessClassification } from './dot.mjs'
import { operationHasAuthoritativeSuccess } from './bounded-publication.mjs'

import { spawnSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  readFileSync,
  mkdirSync,
  mkdtempSync,
  existsSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  getProfile,
  listProfiles,
  resolveProfile,
} from '../routing/router.mjs'
import {
  profileForAttempt,
  repairRetryDecision,
  retryDecision,
  validateRetryPolicy,
} from '../lib/retry-policy.mjs'
import {
  redact,
  redactText,
} from '../lib/redaction.mjs'
import {
  controlDatabaseWaitOutcome,
  executeWithControlDatabaseRetry,
  isControlDatabaseConnectivityError,
} from '../lib/control-database.mjs'
import {
  classifySupervisorFailure,
  planSupervisorStep,
  preflightReconciliationAction,
  supervisorResumeIdentity,
} from './task-supervisor.mjs'
import {
  evaluateExecutionPreflight,
  fingerprint as preflightFingerprint,
} from './task-preflight.mjs'
import { evaluateWorkstreamReadiness, resolveVerificationPlan } from './verification-mode.mjs'
import { mergeVerificationConfig } from '../lib/workstream-readiness.mjs'
import { evaluateParentSatisfaction } from './parent-satisfaction.mjs'
import { retryPurpose, verifiedRepairBaselineFiles, repairFailureChecks, preserveAttributedRun, currentExecution, publicationHoldOutcome } from './recovery-evidence.mjs'
import { durableExecute, receiptPaths, startReceipt, readJson, receiptLocked, stdinPromptRequest, storedPrompt, recoverInterruptedHandoff } from './durable-process.mjs'
import { recoveryBackoff, retryWithoutProductAttempt, runWakeEligibility, taskStatusEvidence } from './selfhealing.mjs'
import { validateVerifierOnlyReacceptance } from './verifier-only-reacceptance.mjs'
import { publicationStateFingerprint } from './publication-preflight.mjs'
import { initialSupervisorLeaseSql } from './supervisor-lease.mjs'
import {
  WATCHER_LEASE_MS,
  WATCHER_MAX_BATCH,
  classifyControlProbe,
  githubProbeCommand,
  githubProbeObservation,
  normalizeWatchDescriptor,
  watchDescriptorForRecovery,
  watchTransition,
} from './external-state-watcher.mjs'
const automationCodexHome =
  process.env.BS_CODEX_HOME ??
  path.join(
    os.homedir(),
    'Services',
    'building-suit-monorepo-plane',
    'codex-home',
  )

const controlDatabase = {
  host:
    process.env.AUTOMATION_CONTROL_DB_HOST ??
    process.env.BS_CONTROL_DB_HOST ??
    '127.0.0.1',

  port:
    process.env.AUTOMATION_CONTROL_DB_PORT ??
    process.env.BS_CONTROL_DB_PORT ??
    '54329',

  database:
    process.env.AUTOMATION_CONTROL_DB_NAME ??
    process.env.BS_CONTROL_DB_NAME ??
    'building_suit_control',

  user:
    process.env.AUTOMATION_CONTROL_DB_USER ??
    process.env.BS_CONTROL_DB_USER ??
    'bs_control_app',

  sslmode:
    process.env.AUTOMATION_CONTROL_DB_SSLMODE ??
    process.env.BS_CONTROL_DB_SSLMODE ??
    'prefer',
}

// Installed source may live in a pinned repair checkout while product worktrees
// and relative project roots remain anchored to the operator's repository.
const controlSourceRoot = fileURLToPath(new URL('../../../', import.meta.url))
const repoRoot = process.env.BS_CONTROL_REPOSITORY_ROOT
  ? path.resolve(process.env.BS_CONTROL_REPOSITORY_ROOT)
  : controlSourceRoot

const githubRepository = 'Building-Suit/building-suit-monorepo'

const [command, ...args] = process.argv.slice(2)

function execute(program, programArgs = [], options = {}) {
  ;({ args: programArgs, options } = stdinPromptRequest(program, programArgs, options))
  const childEnv = {
    ...process.env,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    ...(options.env ?? {}),
  }

  for (const variable of options.unsetEnv ?? []) {
    delete childEnv[variable]
  }

  if (process.env.BS_OPERATION_ID && (program === 'codex' && programArgs[0] === 'exec' || programArgs.some(arg => String(arg).endsWith('/task-verifier.mjs')))) {
    const role = program === 'codex' ? 'codex' : `verifier:${programArgs[3] ?? 'probe'}:${process.env.BS_OPERATION_INFRA_GENERATION ?? 0}`
    return durableExecute(path.join(repoRoot, '.local', 'runtime-receipts'), `${process.env.BS_OPERATION_ID}:${role}`, program, programArgs, {
      ...options, cwd: options.cwd ?? repoRoot, env: childEnv, retryProcessFailure: true,
    })
  }
  const result = spawnSync(
    program,
    programArgs,
    {
      cwd: options.cwd ?? repoRoot,
      encoding: 'utf8',
      env: childEnv,
      input: options.input,
      timeout: options.timeout,
      maxBuffer:
        options.maxBuffer ??
        50 * 1024 * 1024,
    },
  )

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
      path.join(controlSourceRoot, 'tooling/control-plane/runner/codex-models.mjs'),
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

function validTaskId(value) {
  return (
    typeof value === 'string' &&
    /^[A-Z][A-Z0-9-]{2,63}$/.test(value)
  )
}

function validSuitSlug(value) {
  return (
    typeof value === 'string' &&
    /^[a-z][a-z0-9-]{1,63}$/.test(value)
  )
}

function validWorkstreamReference(value) {
  return (
    typeof value === 'string' &&
    /^(?:[a-z][a-z0-9-]{1,63}\/)?[a-z][a-z0-9-]{1,63}$/.test(value)
  )
}

function controlQuery(
  sql,
  variables = {},
) {
  const variableArgs = []

  for (const [name, value] of Object.entries(variables)) {
    variableArgs.push(
      '--set',
      `${name}=${value}`,
    )
  }

  return executeWithControlDatabaseRetry(() => execute(
    'psql',
    [
      '-X',
      '-q',
      '-A',
      '-t',

      '-v',
      'ON_ERROR_STOP=1',

      '-h',
      controlDatabase.host,

      '-p',
      controlDatabase.port,

      '-U',
      controlDatabase.user,

      '-d',
      controlDatabase.database,

      ...variableArgs,
    ],
    {
      input: `${sql.trim()}\n`,

      env: {
        PGSSLMODE:
          controlDatabase.sslmode,
      },
    },
  ))
}

function parseControlJson(result) {
  if (!successful(result)) {
    throw new Error(
      result.stderr ||
      result.error ||
      'Control database query failed.',
    )
  }

  if (!result.stdout) {
    return null
  }

  return JSON.parse(result.stdout)
}

function workstreamResolve() {
  const [reference] = args
  if (!validWorkstreamReference(reference)) {
    output({ ok: false, command: 'workstream-resolve', error: 'valid_workstream_reference_required' }, 64)
    return
  }

  const [projectSlug, workstreamSlug] = reference.includes('/')
    ? reference.split('/', 2)
    : ['', reference]

  try {
    const result = controlQuery(
      `
        WITH matches AS (
          SELECT p.slug AS project_slug, w.slug AS workstream_slug, w.suit_slug
          FROM control.workstreams w
          JOIN control.projects p USING (project_id)
          WHERE p.active = true
            AND w.active = true
            AND (:'project_slug' = '' OR p.slug = :'project_slug')
            AND w.slug = :'workstream_slug'
        )
        SELECT jsonb_build_object(
          'match_count', count(*),
          'workstream', CASE WHEN count(*) = 1 THEN (jsonb_agg(to_jsonb(matches)))->0 ELSE NULL END
        )
        FROM matches;
      `,
      { project_slug: projectSlug, workstream_slug: workstreamSlug },
    )
    const resolved = parseControlJson(result)
    if (Number(resolved?.match_count) !== 1) {
      output({
        ok: false,
        command: 'workstream-resolve',
        reference,
        error: Number(resolved?.match_count) > 1
          ? 'ambiguous_workstream_use_project_slash_workstream'
          : 'unknown_or_inactive_workstream',
      }, 1)
      return
    }
    output({ ok: true, command: 'workstream-resolve', reference, ...resolved.workstream })
  }
  catch (error) {
    output({ ok: false, command: 'workstream-resolve', reference, error: error.message }, 1)
  }
}

function taskNext() {
  const [suitSlug] = args

  if (!validSuitSlug(suitSlug)) {
    output({
      ok: false,
      command: 'task-next',
      error: 'valid_suit_slug_required',
    }, 64)

    return
  }

  try {
    const result = controlQuery(
      `
        SELECT COALESCE(
          jsonb_build_object(
            'task_id', task_id,
            'suit_slug', suit_slug,
            'title', title,
            'task_type', task_type,
            'risk_level', risk_level,
            'model_profile', model_profile,
            'status', status,
            'priority', priority,
            'sequence', sequence
          ),
          'null'::jsonb
        )
        FROM control.next_ready_task(
          :'suit_slug'
        );
      `,
      {
        suit_slug: suitSlug,
      },
    )

    const task = parseControlJson(result)

    output({
      ok: true,
      command: 'task-next',
      suit_slug: suitSlug,
      task,
    })
  }
  catch (error) {
    output({
      ok: false,
      command: 'task-next',
      error: error.message,
    }, 1)
  }
}

function taskPacket() {
  const [taskId] = args

  if (!validTaskId(taskId)) {
    output({
      ok: false,
      command: 'task-packet',
      error: 'valid_task_id_required',
    }, 64)

    return
  }

  try {
    const result = controlQuery(
      `
        SELECT COALESCE(
          control.generic_task_packet(
            :'task_id'
          ),
          'null'::jsonb
        );
      `,
      {
        task_id: taskId,
      },
    )

    output({
      ok: true,
      command: 'task-packet',
      task_id: taskId,
      packet:
        parseControlJson(result),
    })
  }
  catch (error) {
    output({
      ok: false,
      command: 'task-packet',
      error: error.message,
    }, 1)
  }
}

function taskClaim() {
  const [suitSlug] = args

  if (!validSuitSlug(suitSlug)) {
    output({
      ok: false,
      command: 'task-claim',
      error: 'valid_suit_slug_required',
    }, 64)

    return
  }

  try {
    const result = controlQuery(
      `
        SELECT COALESCE(
          control.claim_next_task(
            :'suit_slug',
            'runner'
          ),
          'null'::jsonb
        );
      `,
      {
        suit_slug: suitSlug,
      },
    )

    output({
      ok: true,
      command: 'task-claim',
      suit_slug: suitSlug,
      packet:
        parseControlJson(result),
    })
  }
  catch (error) {
    output({
      ok: false,
      command: 'task-claim',
      error: error.message,
    }, 1)
  }
}

function taskRelease() {
  const [taskId] = args

  if (!validTaskId(taskId)) {
    output({
      ok: false,
      command: 'task-release',
      error: 'valid_task_id_required',
    }, 64)

    return
  }

  try {
    const result = controlQuery(
      `
        SELECT jsonb_build_object(
          'released',
          control.release_task_claim(
            :'task_id',
            'runner'
          )
        );
      `,
      {
        task_id: taskId,
      },
    )

    output({
      ok: true,
      command: 'task-release',
      task_id: taskId,
      result:
        parseControlJson(result),
    })
  }
  catch (error) {
    output({
      ok: false,
      command: 'task-release',
      error: error.message,
    }, 1)
  }
}

function runJsonHelper(
  relativePath,
  helperArgs = [],
  options = {},
) {
  const result = execute(
    process.execPath,
    [
      path.resolve(controlSourceRoot, relativePath),
      ...helperArgs,
    ],
    options,
  )

  if (!successful(result)) {
    throw new Error(
      result.stderr ||
      result.error ||
      result.stdout ||
      `${relativePath} failed`,
    )
  }

  return JSON.parse(
    result.stdout,
  )
}

function projectRuntime(packet) {
  const project = packet.project ?? {}
  return {
    repository_root: project.local_repository_root ?? '.',
    worktree_root: project.worktree_root ?? '.local/worktrees',
    github_repository: project.github_repository ?? githubRepository,
    integration_branch: project.integration_branch ?? 'stg',
  }
}

function resolveStackParent(stackKey, project) {
  return runJsonHelper(
    'tooling/control-plane/runner/stack-parent.mjs',
    [
      stackKey,
      project.repository_root,
      project.github_repository,
      project.integration_branch,
    ],
  )
}

function prepareTaskWorktree(
  taskId,
  stackKey,
  parentSha,
  project,
) {
  return runJsonHelper(
    'tooling/control-plane/runner/task-worktree.mjs',
    [
      taskId,
      stackKey,
      parentSha,
      project.repository_root,
      project.worktree_root,
    ],
  )
}

function taskPrepare() {
  const [taskId] = args

  if (!validTaskId(taskId)) {
    output({
      ok: false,
      command: 'task-prepare',
      error:
        'valid_task_id_required',
    }, 64)

    return
  }

  try {
    const packetResult =
      controlQuery(
        `
          SELECT COALESCE(
            control.generic_task_packet(
              :'task_id'
            ),
            'null'::jsonb
          );
        `,
        {
          task_id: taskId,
        },
      )

    const packet =
      parseControlJson(
        packetResult,
      )

    if (!packet) {
      throw new Error(
        `Unknown task: ${taskId}`,
      )
    }

    if (
      packet.task.status !==
      'in_progress'
    ) {
      throw new Error(
        `Task ${taskId} must be claimed before preparation.`,
      )
    }

    const verificationReadiness = evaluateWorkstreamReadiness(packet)
    if (!verificationReadiness.ready) {
      output({
        ok: false,
        command: 'task-prepare',
        task_id: taskId,
        error: verificationReadiness.reason,
        classification: {
          failure_class: verificationReadiness.failure_class,
          recovery_action: 'wait-operator',
        },
        unenforced: verificationReadiness.unenforced ?? [],
      }, 1)
      return
    }

    const stackKey =
      packet.suit.stack_key

    const project =
      projectRuntime(packet)

    const parent =
      resolveStackParent(
        stackKey,
        project,
      )

    const prepared =
      prepareTaskWorktree(
        taskId,
        stackKey,
        parent.parent_sha,
        project,
      )

    controlQuery(
      `
        UPDATE control.tasks
        SET metadata = jsonb_set(
              metadata,
              '{preparation}',
              :'preparation'::jsonb,
              true
            ),
            engine_stage = 'prepared'
        WHERE task_id = :'task_id';
        INSERT INTO control.audit_events(
          project_id, workstream_slug, task_id, action, source, new_value
        )
        SELECT project_id, workstream_slug, task_id, 'task_prepared', 'runner', :'preparation'::jsonb
        FROM control.tasks WHERE task_id = :'task_id';
        SELECT jsonb_build_object('recorded', true);
      `,
      {
        task_id: taskId,
        preparation: JSON.stringify({ parent, worktree: prepared }),
      },
    )

    output({
      ok: true,
      command: 'task-prepare',
      task_id: taskId,
      parent,
      worktree: prepared,
    })
  }
  catch (error) {
    output({
      ok: false,
      command: 'task-prepare',
      error:
        error.message,
    }, 1)
  }
}

function startExecution({
  taskId,
  route,
  worktree,
  parent,
  retryPolicy,
  promptPath,
}) {
  const startedResult =
    controlQuery(
      `
        SELECT jsonb_build_object(
          'execution_id',
          COALESCE(
            (
              SELECT execution_id
              FROM control.executions
              WHERE task_id = :'task_id'
                AND status = 'running'
              ORDER BY attempt DESC
              LIMIT 1
            ),
            control.start_execution(
            :'task_id',
            :'model_profile',
            :'model_name',
            :'reasoning_effort',
            :'worktree_path',
            :'branch_name',
            :'parent_branch',
            :'parent_sha'
            )
          )
        );
      `,
      {
        task_id:
          taskId,

        model_profile:
          route.profile,

        model_name:
          route.model,

        reasoning_effort:
          route.reasoning_effort,

        worktree_path:
          worktree.worktree_path,

        branch_name:
          worktree.branch_name,

        parent_branch:
          parent.parent_branch,

        parent_sha:
          parent.parent_sha,
      },
    )


  const started =
    parseControlJson(
      startedResult,
    )


  const executionId =
    started?.execution_id


  if (!executionId) {
    throw new Error(
      'control.start_execution returned no execution_id.',
    )
  }


  const recordedResult =
    controlQuery(
      `
        UPDATE control.executions
        SET
          resolved_retry_policy =
            :'retry_policy'::jsonb,

          prompt_path =
            :'prompt_path',

          engine_stage =
            'implementation'

        WHERE execution_id =
          :'execution_id'::bigint

        RETURNING jsonb_build_object(
          'execution_id',
          execution_id
        );
      `,
      {
        execution_id:
          String(executionId),

        retry_policy:
          JSON.stringify(
            retryPolicy,
          ),

        prompt_path:
          promptPath,
      },
    )


  const recorded =
    parseControlJson(
      recordedResult,
    )


  if (
    recorded?.execution_id !==
    executionId
  ) {
    throw new Error(
      `Unable to record metadata for execution ${executionId}.`,
    )
  }


  attachRuntimeExecution(executionId)
  return executionId
}

function finishExecution({
  executionId,
  status,
  promptBytes,
  outputBytes,
  runLogPath,
  metadata = {},
}) {
  const result =
    controlQuery(
      `
        SELECT jsonb_build_object(
          'finished',
          control.finish_execution(
            :'execution_id'::bigint,
            :'status',
            NULL,
            :'prompt_bytes'::bigint,
            :'output_bytes'::bigint,
            :'run_log_path',
            :'metadata'::jsonb
          )
        );
      `,
      {
        execution_id:
          String(executionId),

        status,

        prompt_bytes:
          String(promptBytes),

        output_bytes:
          String(outputBytes),

        run_log_path:
          runLogPath,

        metadata:
          JSON.stringify(metadata),
      },
    )

  return parseControlJson(
    result,
  )
}

function taskRun() {
  if (!process.env.BS_OPERATION_ID) { taskSupervisor(); return }
  const [taskId] = args

  if (!validTaskId(taskId)) {
    output({
      ok: false,
      command: 'task-run',
      error:
        'valid_task_id_required',
    }, 64)

    return
  }

  let executionId = null

  try {
    const packetResult =
      controlQuery(
        `
          SELECT COALESCE(
            control.generic_task_packet(
              :'task_id'
            ),
            'null'::jsonb
          );
        `,
        {
          task_id: taskId,
        },
      )

    const packet =
      parseControlJson(
        packetResult,
      )

    if (!packet) {
      throw new Error(
        `Unknown task: ${taskId}`,
      )
    }

    if (
      packet.task.status !==
      'in_progress'
    ) {
      throw new Error(
        `Task ${taskId} is not claimed.`,
      )
    }

    const existingExecution = latestExecution(taskId)
    const resumeExecution = existingExecution?.status === 'running' ? existingExecution : null
    const executionPreflight = resumeExecution ? { ready: true } : runExecutionPreflight(supervisorSnapshot(taskId), 'implementation')
    if (!executionPreflight.ready) {
      output({
        ok: false,
        command: 'task-run',
        task_id: taskId,
        error: executionPreflight.reason,
        preflight: executionPreflight,
      }, 1)
      return
    }

    const verificationReadiness = evaluateWorkstreamReadiness(packet)
    if (!verificationReadiness.ready) {
      output({
        ok: false,
        command: 'task-run',
        task_id: taskId,
        error: verificationReadiness.reason,
        classification: {
          failure_class: verificationReadiness.failure_class,
          recovery_action: 'wait-operator',
        },
        unenforced: verificationReadiness.unenforced ?? [],
      }, 1)
      return
    }

    const project =
      projectRuntime(packet)

    const prepared = packet.preparation

    const parent =
      prepared?.parent ??
      resolveStackParent(
        packet.suit.stack_key,
        project,
      )

    const worktree =
      prepared?.worktree ??
      prepareTaskWorktree(
        taskId,
        packet.suit.stack_key,
        parent.parent_sha,
        project,
      )

    if (!existsSync(worktree.worktree_path)) {
      throw new Error(
        'prepared_worktree_not_found',
      )
    }

    const retryPolicy =
      validateRetryPolicy(
        packet.retry_policy,
      )

    const firstProfile =
      profileForAttempt(
        retryPolicy,
        1,
      )

    const route = resumeExecution ? { uses_codex: true, profile: resumeExecution.model_profile, model: resumeExecution.model_name, reasoning_effort: resumeExecution.reasoning_effort } :
      firstProfile === 'no_ai'
        ? resolveProfile(
            'no_ai',
            [],
          )
        : resolveCodexRoute(
            firstProfile,
          )

    if (!route.uses_codex) {
      throw new Error(
        'task-run requires a Codex profile.',
      )
    }

    const taskDirectory =
      path.join(
        worktree.worktree_path,
        '.local',
        'agent-tasks',
      )

    const runDirectory =
      path.join(
        worktree.worktree_path,
        '.local',
        'agent-runs',
        taskId,
      )

    mkdirSync(
      taskDirectory,
      {
        recursive: true,
      },
    )

    mkdirSync(
      runDirectory,
      {
        recursive: true,
      },
    )

    const packetPath =
      path.join(
        taskDirectory,
        `${taskId}.json`,
      )

    writeFileSync(
      packetPath,
      `${JSON.stringify(
        packet,
        null,
        2,
      )}\n`,
      {
        mode: 0o600,
      },
    )

    const promptResult =
      execute(
        process.execPath,
        [
          path.join(
            controlSourceRoot,
            'tooling',
            'control-plane',
            'runner',
            'task-prompt.mjs',
          ),
          packetPath,
        ],
        {
          cwd:
            worktree.worktree_path,
        },
      )

    if (!successful(promptResult)) {
      throw new Error(
        'Unable to build task prompt.',
      )
    }

    const prompt = resumeExecution?.prompt_path && existsSync(resumeExecution.prompt_path) ? storedPrompt(readFileSync(resumeExecution.prompt_path, 'utf8')) : promptResult.stdout

    const promptPath =
      path.join(
        runDirectory,
        'prompt.txt',
      )

    const logPath =
      path.join(
        runDirectory,
        'codex.jsonl',
      )

    writeFileSync(
      promptPath,
      `${prompt}\n`,
      {
        mode: 0o600,
      },
    )

    executionId =
      startExecution({
        taskId,
        route,
        worktree,
        parent,
        retryPolicy,
        promptPath,
      })

    const startedAt =
      Date.now()

    const codexResult =
      execute(
        'codex',
        [
          'exec',
          '--json',
          '--ephemeral',

          '--sandbox',
          'workspace-write',

          '-C',
          worktree.worktree_path,

          '--model',
          route.model,

          '-c',
          `model_reasoning_effort="${route.reasoning_effort}"`,

          prompt,
        ],
        codexExecutionOptions({
          cwd:
            worktree.worktree_path,

          timeout:
            45 * 60 * 1000,
        }),
      )

    writeFileSync(
      logPath,
      `${codexResult.stdout}\n`,
      {
        mode: 0o600,
      },
    )

    const elapsedMs =
      Date.now() - startedAt

    const succeeded =
      successful(codexResult)

    if (!succeeded) {
      output({ ok: false, command: 'task-run', task_id: taskId, execution_id: executionId,
        error: workerProcessClassification(codexResult).failure_class==='operator-wait'?'chatgpt_authentication_required':'worker_process_interrupted', classification: workerProcessClassification(codexResult),
        execution: { log_path: logPath, exit_code: codexResult.code } }, 1)
      return
    }
    finishExecution({
      executionId,

      status:
        succeeded
          ? 'succeeded'
          : 'failed',

      promptBytes:
        Buffer.byteLength(
          prompt,
          'utf8',
        ),

      outputBytes:
        Buffer.byteLength(
          codexResult.stdout,
          'utf8',
        ),

      runLogPath:
        logPath,

      metadata: {
        elapsed_ms:
          elapsedMs,

        exit_code:
          codexResult.code,

        stderr:
          codexResult.stderr
            ? codexResult.stderr.slice(
                0,
                4000,
              )
            : '',
      },
    })

    if (!succeeded) {
      recordControlFailure(
        taskId,
        'implementation',
        codexResult.stderr || 'codex_execution_failed',
        { exit_code: codexResult.code, log_path: logPath },
      )
    }

    output({
      ok: succeeded,

      command:
        'task-run',

      task_id:
        taskId,

      execution_id:
        executionId,

      route: {
        profile:
          route.profile,

        model:
          route.model,

        reasoning_effort:
          route.reasoning_effort,
      },

      parent,

      worktree,

      execution: {
        exit_code:
          codexResult.code,

        elapsed_ms:
          elapsedMs,

        log_path:
          logPath,
      },
    }, succeeded ? 0 : 1)
  }
  catch (error) {
    output({
      classification: { failure_class: executionId || isControlDatabaseConnectivityError(error) ? 'transient-infrastructure' : 'safety-stop', recovery_action: executionId || isControlDatabaseConnectivityError(error) ? 'wait-external' : 'safety-stop' },
      ok: false,
      command: 'task-run',
      task_id: taskId,
      execution_id:
        executionId,
      error:
        error.message,
    }, 1)
  }
}

function latestExecution(taskId) {
  const result =
    controlQuery(
      `
        SELECT COALESCE(
          control.latest_execution(
            :'task_id'
          ),
          'null'::jsonb
        );
      `,
      {
        task_id:
          taskId,
      },
    )

  return parseControlJson(
    result,
  )
}

function recordControlFailure(
  taskId,
  stage,
  error,
  metadata = {},
) {
  try {
    const safeError = redactText(error ?? 'Unknown failure')
    const safeMetadata = redact(metadata)
    const execution = latestExecution(taskId)
    const policy = resolvedRetryPolicy(taskId)
    const decision = execution
      ? retryDecision(policy, Math.max(1, supervisorSnapshot(taskId).retry_accounting?.consumed ?? execution.attempt))
      : { allowed: false }
    const failureClass = safeMetadata.classification?.failure_class ?? null
    const recoveryAction = safeMetadata.classification?.recovery_action ?? null
    const implementationRetryAllowed =
      decision.allowed &&
      (!failureClass || failureClass === 'verification-product-defect')
    const legalActions = ['inspect', 'error-bundle', 'resume']
    if (stage === 'verification') legalActions.push('reverify')
    if (implementationRetryAllowed) legalActions.push('retry')
    if (stage === 'publication') legalActions.push('publish', 'reparent')
    controlQuery(
      `
        INSERT INTO control.failures(
          project_id,workstream_slug,task_id,execution_id,attempt,stage,error_code,
          summary,raw_error,retry_available,next_profile,human_intervention_required,
          legal_actions,metadata,failure_class,recovery_action,recoverable
        )
        SELECT t.project_id,t.workstream_slug,t.task_id,
          NULLIF(:'execution_id','')::bigint,NULLIF(:'attempt','')::integer,:'stage',:'error_code',
          :'summary',:'raw_error',:'retry_available'::boolean,NULLIF(:'next_profile',''),
          :'human_required'::boolean,:'legal_actions'::jsonb,:'metadata'::jsonb,
          COALESCE(NULLIF(:'failure_class',''), 'operator-wait'),
          COALESCE(NULLIF(:'recovery_action',''), 'wait-operator'), true
        FROM control.tasks t WHERE t.task_id=:'task_id';
        SELECT jsonb_build_object('recorded',true);
      `,
      {
        task_id: taskId,
        execution_id: execution ? String(execution.execution_id) : '',
        attempt: execution ? String(execution.attempt) : '',
        stage,
        error_code: safeError.split(/\s/)[0].slice(0,120) || 'failure',
        summary: safeError.slice(0,1000),
        raw_error: JSON.stringify(safeMetadata).slice(0,12000),
        retry_available: implementationRetryAllowed ? 'true' : 'false',
        next_profile: implementationRetryAllowed ? decision.next_profile ?? '' : '',
        human_required: ['publication','reparent'].includes(stage) ? 'true' : 'false',
        legal_actions: JSON.stringify(legalActions),
        metadata: JSON.stringify(safeMetadata),
        failure_class: failureClass ?? '',
        recovery_action: recoveryAction ?? '',
      },
    )
  }
  catch {
    // Failure recording must not replace the original runner error.
  }
}

function beginVerification(
  taskId,
  executionId,
  verificationMode,
) {
  const requestId = randomUUID()

  const startedResult = controlQuery(
    `
      SELECT jsonb_build_object(
        'verification_run_id', control.start_verification_run(
          :'task_id', :'execution_id'::bigint, 'runner',
          jsonb_build_object(
            'verification_mode', :'verification_mode',
            'start_request_id', :'start_request_id'
          )
        )
      );
    `,
    {
      task_id: taskId,
      execution_id: String(executionId),
      verification_mode: verificationMode,
      start_request_id: requestId,
    },
  )
  const started = parseControlJson(startedResult)
  if (!started?.verification_run_id) {
    throw new Error('verification_lifecycle_start_returned_no_run')
  }

  // Read in a new statement so PostgreSQL cannot hide a row inserted by the
  // state-changing function behind the caller statement's original snapshot.
  const result = controlQuery(
    `
        SELECT jsonb_build_object(
          'verification_run_id', vr.verification_run_id,
          'verification_mode', vr.verification_mode,
          'resumed', COALESCE(vr.metadata->>'start_request_id', '') <> :'start_request_id'
        )
        FROM control.verification_runs vr
        WHERE vr.verification_run_id = :'verification_run_id'::bigint;
    `,
    {
      verification_run_id: String(started.verification_run_id),
      start_request_id: requestId,
    },
  )

  const verificationRun = parseControlJson(result)
  if (!verificationRun?.verification_run_id) {
    throw new Error('verification_lifecycle_authoritative_run_unavailable')
  }
  return verificationRun
}

function queueVerificationChecks(
  verificationRunId,
) {
  const checks = [
    ['dependencies', 'pnpm install --frozen-lockfile --prefer-offline'],
    ['git-diff-check', 'git diff --check'],
    ['workspace-check', 'pnpm check'],
    ['app-typecheck', 'project-configured typecheck'],
    ['app-lint', 'project-configured lint'],
    ['app-unit', 'project-configured unit tests'],
    ['app-build', 'project-configured build'],
    ['database-tests', 'project-configured focused database tests'],
    ['browser-tests', 'project-configured focused browser tests'],
  ]

  for (const [name, checkCommand] of checks) {
    controlQuery(
      `
        SELECT jsonb_build_object(
          'verification_id',
          control.queue_verification_check(
            :'verification_run_id'::bigint,
            :'check_name',
            :'check_command',
            true
          )
        );
      `,
      {
        verification_run_id: String(verificationRunId),
        check_name: name,
        check_command: checkCommand,
      },
    )
  }
}

function skipUnselectedVerificationChecks(
  verificationRunId,
  selectedNames,
) {
  const result = controlQuery(
    `
      WITH updated AS (
        UPDATE control.verification_results
        SET status = 'skipped',
            summary = 'Not selected by the task-focused verification plan.',
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'selection_reason', 'not_selected_by_verifier',
              'verification_mode', (
                SELECT verification_mode
                FROM control.verification_runs
                WHERE verification_run_id = :'verification_run_id'::bigint
              )
            ),
            started_at = COALESCE(started_at, now()),
            finished_at = now(),
            elapsed_ms = 0
        WHERE verification_run_id = :'verification_run_id'::bigint
          AND status IN ('queued','running')
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(:'selected_names'::jsonb) AS selected(check_name)
            WHERE selected.check_name = verification_results.check_name
          )
        RETURNING verification_id
      )
      SELECT jsonb_build_object('skipped', count(*)) FROM updated;
    `,
    {
      verification_run_id: String(verificationRunId),
      selected_names: JSON.stringify([...selectedNames]),
    },
  )

  return parseControlJson(result)
}

function recordVerificationState(
  verificationRunId,
  verifiedState,
  classification,
) {
  if (!verifiedState?.fingerprint) {
    if (classification?.failure_class) return null
    throw new Error(
      'Verifier did not return an authoritative repository state fingerprint.',
    )
  }

  const result = controlQuery(
    `
      UPDATE control.verification_runs
      SET metadata = COALESCE(metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'verified_state', :'verified_state'::jsonb,
          'failure_class', NULLIF(:'failure_class', ''),
          'recovery_action', NULLIF(:'recovery_action', '')
        )
      WHERE verification_run_id = :'verification_run_id'::bigint
        AND status = 'running'
      RETURNING jsonb_build_object(
        'verification_run_id', verification_run_id,
        'state_fingerprint', metadata->'verified_state'->>'fingerprint'
      );
    `,
    {
      verification_run_id: String(verificationRunId),
      verified_state: JSON.stringify(verifiedState),
      failure_class: classification?.failure_class ?? '',
      recovery_action: classification?.recovery_action ?? '',
    },
  )

  const recorded = parseControlJson(result)
  if (recorded?.state_fingerprint !== verifiedState.fingerprint) {
    throw new Error('Unable to persist verified repository state.')
  }
}

function recordVerification(
  verificationRunId,
  check,
) {
  const result =
    controlQuery(
      `
        SELECT jsonb_build_object(
          'verification_id',
          control.update_verification_check(
            :'verification_run_id'::bigint,
            :'check_name',
            :'status',
            NULLIF(
              :'exit_code',
              ''
            )::integer,
            :'summary',
            :'log_path',
            :'elapsed_ms'::bigint,
            :'command',
            :'required'::boolean,
            :'metadata'::jsonb
          )
        );
      `,
      {
        verification_run_id:
          String(verificationRunId),

        check_name:
          check.name,

        command:
          check.command ?? '',

        status:
          check.status,

        exit_code:
          check.exit_code === null
            ? ''
            : String(
                check.exit_code,
              ),

        summary:
          check.summary ?? '',

        log_path:
          check.log_path ?? '',

        elapsed_ms:
          String(check.elapsed_ms ?? 0),

        required:
          check.required === false ? 'false' : 'true',

        metadata:
          JSON.stringify({
            selection_reason:
              check.selection_reason ?? 'unspecified',
            verification_mode:
              check.verification_mode ?? null,
            failure_class:
              check.failure_class ?? null,
          }),
      },
    )

  return parseControlJson(
    result,
  )
}

function finalizeVerification(
  taskId,
  verificationRunId,
) {
  const result =
    controlQuery(
      `
        SELECT
          control.finish_verification_run(
            :'task_id',
            :'verification_run_id'::bigint
          );
      `,
      {
        task_id:
          taskId,

        verification_run_id:
          String(verificationRunId),
      },
    )

  return parseControlJson(
    result,
  )
}

function taskVerify() {
  if (!process.env.BS_OPERATION_ID) { taskSupervisor(); return }
  const [taskId] = args
  let verificationLifecycleStage = 'load'

  if (!validTaskId(taskId)) {
    output({
      ok: false,
      command:
        'task-verify',
      error:
        'valid_task_id_required',
    }, 64)

    return
  }

  try {
    const packetResult =
      controlQuery(
        `
          SELECT COALESCE(
            control.generic_task_packet(
              :'task_id'
            ),
            'null'::jsonb
          );
        `,
        {
          task_id:
            taskId,
        },
      )

    const packet =
      parseControlJson(
        packetResult,
      )

    if (!packet) {
      throw new Error(
        `Unknown task: ${taskId}`,
      )
    }

    const verificationReadiness = evaluateWorkstreamReadiness(packet)
    if (!verificationReadiness.ready) {
      output({
        ok: false,
        command: 'task-verify',
        task_id: taskId,
        error: verificationReadiness.reason,
        classification: {
          failure_class: verificationReadiness.failure_class,
          recovery_action: 'wait-operator',
        },
        unenforced: verificationReadiness.unenforced ?? [],
      }, 1)
      return
    }

    if (packet.task.status === 'failed') {
      const failure = latestOpenControlFailure(taskId)
      const reverifyClasses = new Set([
        'verification-lifecycle',
        'verification-configuration',
        'verification-infrastructure',
        'verification-required-check-unavailable',
      ])
      const effectiveClass=effectiveFailureClass(supervisorSnapshot(taskId),failure?.failure_class)
      if (!reverifyClasses.has(effectiveClass)) {
        throw new Error('failed_task_requires_implementation_repair')
      }
      controlQuery(
        `SELECT control.reopen_verification(:'task_id', 'supervisor', :'reason');`,
        {
          task_id: taskId,
          reason: `same-execution reverify after ${effectiveClass}`,
        },
      )
    }

    const execution =
      latestExecution(
        taskId,
      )

    if (!execution) {
      throw new Error(
        `Task ${taskId} has no execution.`,
      )
    }

    if (
      execution.status !==
      'succeeded'
    ) {
      throw new Error(
        `Latest execution is ${execution.status}, not succeeded.`,
      )
    }

    if (
      !execution.worktree_path
    ) {
      throw new Error(
        'Execution has no worktree path.',
      )
    }

    const packetPath =
      path.join(
        execution.worktree_path,
        '.local',
        'agent-tasks',
        `${taskId}.json`,
      )

    mkdirSync(path.dirname(packetPath), { recursive: true })
    writeFileSync(
      packetPath,
      `${JSON.stringify(packet, null, 2)}\n`,
      { mode: 0o600 },
    )

    const verificationDirectory =
      path.join(
        execution.worktree_path,
        '.local',
        'agent-runs',
        taskId,
        'verification',
      )

    verificationLifecycleStage = 'start'
    const verificationRun =
      beginVerification(
      taskId,
      execution.execution_id,
      packet.task.verification_mode ?? 'focused',
    )

    verificationLifecycleStage = 'execute'

    const verificationRunId =
      verificationRun.verification_run_id

    const verificationMode =
      verificationRun.verification_mode

    if (!verificationRun.resumed) {
      queueVerificationChecks(
        verificationRunId,
      )
    }

    const verifier =
      execute(
        process.execPath,
        [
          path.join(
            controlSourceRoot,
            'tooling',
            'control-plane',
            'runner',
            'task-verifier.mjs',
          ),

          execution.worktree_path,
          packetPath,
          verificationDirectory,
          String(verificationRunId),
          verificationMode,
        ],
        {
          cwd:
            execution.worktree_path,

          timeout:
            60 * 60 * 1000,
        },
      )

    if (
      !successful(verifier) &&
      [verifier.stdout, verifier.stderr, verifier.error]
        .filter(Boolean)
        .some(value => String(value).includes('control_database_connectivity_exhausted'))
    ) {
      throw new Error('control_database_connectivity_exhausted')
    }

    let verification

    try {
      verification =
        JSON.parse(
          verifier.stdout,
        )
    }
    catch {
      verification = {
        ok: false,
        passed: false,
        classification: {
          failure_class: 'verification-infrastructure',
          recovery_action: 'wait-external',
        },
        checks: [
          {
            name:
              'verifier-infrastructure',

            command:
              null,

            required:
              true,

            status:
              'fail',

            failure_class:
              'verification-infrastructure',

            exit_code:
              verifier.code,

            summary:
              verifier.stderr ||
              verifier.error ||
              verifier.stdout ||
              'Verifier returned invalid output.',

            log_path:
              null,

            elapsed_ms:
              0,
          },
        ],
      }
    }

    if (
      !Array.isArray(
        verification.checks,
      ) ||
      verification.checks.length === 0
    ) {
      verification.checks = [
        {
          name:
            'verifier-infrastructure',

          command:
            null,

          required:
            true,

          status:
            'fail',

          failure_class:
            'verification-infrastructure',

          exit_code:
            verifier.code,

          summary:
            verification.error ||
            'Verifier produced no checks.',

          log_path:
            null,

          elapsed_ms:
            0,
        },
      ]
      verification.classification = {
        failure_class: 'verification-infrastructure',
        recovery_action: 'wait-external',
      }
    }

    verificationLifecycleStage = 'record'
    recordVerificationState(
      verificationRunId,
      verification.verified_state,
      verification.classification,
    )

    for (
      const check
      of verification.checks
    ) {
      recordVerification(
        verificationRunId,
        check,
      )
    }

    skipUnselectedVerificationChecks(
      verificationRunId,
      new Set(
        verification.checks.map(
          check => check.name,
        ),
      ),
    )

    verificationLifecycleStage = 'finalize'
    const finalResult =
      finalizeVerification(
        taskId,
        verificationRunId,
      )

    if (!finalResult.passed) {
      recordControlFailure(
        taskId,
        'verification',
        'verification_failed',
        {
          verification_run_id: verificationRunId,
          checks: verification.checks,
          classification: verification.classification,
        },
      )
    }

    output({
      ok:
        finalResult.passed === true,

      command:
        'task-verify',

      task_id:
        taskId,

      execution_id:
        execution.execution_id,

      verification_run_id:
        verificationRunId,

      verification_mode:
        verificationMode,

      result:
        finalResult,

      classification:
        verification.classification,

      checks:
        verification.checks.map(
          check => ({
            name:
              check.name,

            status:
              check.status,

            exit_code:
              check.exit_code,

            summary:
              check.summary,
          }),
        ),
    }, finalResult.passed ? 0 : 1)
  }
  catch (error) {
    const infrastructure = /control_database_connectivity|connect|network|timeout|temporar/i.test(
      String(error.message),
    )
    const lifecycle =
      !infrastructure &&
      (
        ['start', 'record', 'finalize'].includes(verificationLifecycleStage) ||
        String(error.message).startsWith('verification_lifecycle_')
      )
    const classification = lifecycle
      ? { failure_class: 'verification-lifecycle', recovery_action: 'reverify' }
      : { failure_class: 'verification-infrastructure', recovery_action: 'wait-external' }
    recordControlFailure(
      taskId,
      'verification',
      error.message,
      { classification },
    )
    output({
      ok: false,
      command:
        'task-verify',
      task_id:
        taskId,
      error:
        error.message,
      classification,
    }, 1)
  }
}

function resolvedRetryPolicy(
  taskId,
) {
  const result = controlQuery(
    `
      SELECT COALESCE(
        control.resolved_retry_policy(:'task_id'),
        'null'::jsonb
      );
    `,
    {
      task_id: taskId,
    },
  )

  return validateRetryPolicy(
    parseControlJson(result),
  )
}

function retryRoute() {
  const [
    taskId,
    previousAttemptText,
  ] = args

  const previousAttempt =
    Number(
      previousAttemptText,
    )

  if (
    !Number.isInteger(
      previousAttempt,
    ) ||
    previousAttempt < 1
  ) {
    output({
      ok: false,
      command:
        'retry-route',
      error:
        'valid_previous_attempt_required',
    }, 64)

    return
  }

  try {
    if (!validTaskId(taskId)) {
      throw new Error(
        'retry-route now requires a task ID so policy inheritance is explicit.',
      )
    }

    const policy =
      resolvedRetryPolicy(taskId)

    const decision =
      retryDecision(
        policy,
        previousAttempt,
      )

    output({
      ok: true,

      command:
        'retry-route',

      task_id:
        taskId,

      policy,

      previous_attempt:
        previousAttempt,

      ...decision,
    })
  }
  catch (error) {
    output({
      ok: false,
      command:
        'retry-route',
      error:
        error.message,
    }, 64)
  }
}

function verificationFailures(
  executionId,
) {
  const result =
    controlQuery(
      `
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'check_name',
                check_name,

              'status',
                status,

              'exit_code',
                exit_code,

              'summary',
                summary,

              'log_path',
                log_path,

              'failure_class',
                metadata->>'failure_class'
            )
            ORDER BY verification_id
          ),
          '[]'::jsonb
        )
        FROM control.verification_results
        WHERE verification_run_id = (
          SELECT verification_run_id
          FROM control.verification_runs
          WHERE execution_id = :'execution_id'::bigint
          ORDER BY verification_run_id DESC
          LIMIT 1
        )
          AND status IN (
            'fail',
            'not_run'
          );
      `,
      {
        execution_id:
          String(
            executionId,
          ),
      },
    )

  return (
    parseControlJson(
      result,
    ) ?? []
  )
}

function latestOpenControlFailure(
  taskId,
) {
  const result =
    controlQuery(
      `
        SELECT COALESCE(
          (
            SELECT to_jsonb(f)
            FROM control.failures f
            WHERE f.task_id =
              :'task_id'
              AND f.resolved_at IS NULL
            ORDER BY
              f.created_at DESC,
              f.failure_id DESC
            LIMIT 1
          ),
          'null'::jsonb
        );
      `,
      {
        task_id:
          taskId,
      },
    )


  return parseControlJson(
    result,
  )
}


function startRetryExecution(
  taskId,
  route,
  retryPolicy,
) {
  const startedResult =
    controlQuery(
      `
        WITH current_execution AS (
          SELECT *
          FROM control.executions
          WHERE task_id = :'task_id'
            AND status = 'running'
          ORDER BY attempt DESC
          LIMIT 1
        )
        SELECT COALESCE(
          (
            SELECT jsonb_build_object(
              'allowed', true,
              'execution_id', execution_id,
              'attempt', attempt,
              'previous_execution_id', (
                SELECT previous.execution_id
                FROM control.executions previous
                WHERE previous.task_id = current_execution.task_id
                  AND previous.attempt < current_execution.attempt
                ORDER BY previous.attempt DESC
                LIMIT 1
              ),
              'previous_attempt', attempt - 1,
              'worktree_path', worktree_path,
              'branch_name', branch_name,
              'parent_branch', parent_branch,
              'parent_sha', parent_sha,
              'resumed', true
            )
            FROM current_execution
          ),
          control.start_retry_execution(
            :'task_id',
            :'max_attempts'::integer,
            :'model_profile',
            :'model_name',
            :'reasoning_effort'
          )
        );
      `,
      {
        task_id:
          taskId,

        max_attempts:
          String(
            retryPolicy.max_attempts,
          ),

        model_profile:
          route.profile,

        model_name:
          route.model,

        reasoning_effort:
          route.reasoning_effort,
      },
    )


  const started =
    parseControlJson(
      startedResult,
    )


  if (
    !started ||
    started.allowed !== true ||
    !started.execution_id
  ) {
    return started
  }


  const recordedResult =
    controlQuery(
      `
        UPDATE control.executions
        SET
          resolved_retry_policy =
            :'retry_policy'::jsonb,

          engine_stage =
            'implementation'

        WHERE execution_id =
          :'execution_id'::bigint

        RETURNING jsonb_build_object(
          'execution_id',
          execution_id
        );
      `,
      {
        execution_id:
          String(
            started.execution_id,
          ),

        retry_policy:
          JSON.stringify(
            retryPolicy,
          ),
      },
    )


  const recorded =
    parseControlJson(
      recordedResult,
    )


  if (
    recorded?.execution_id !==
    started.execution_id
  ) {
    throw new Error(
      `Unable to record metadata for retry execution ${started.execution_id}.`,
    )
  }


  attachRuntimeExecution(started.execution_id)
  return started
}

function validateRetryWorktree(
  execution,
) {
  if (
    !execution.worktree_path ||
    !existsSync(
      execution.worktree_path,
    )
  ) {
    throw new Error(
      'Previous execution worktree no longer exists.',
    )
  }

  const branchResult =
    execute(
      'git',
      [
        'branch',
        '--show-current',
      ],
      {
        cwd:
          execution.worktree_path,
      },
    )

  if (!successful(branchResult)) {
    throw new Error(
      'Unable to inspect retry worktree branch.',
    )
  }

  if (
    branchResult.stdout !==
    execution.branch_name
  ) {
    throw new Error(
      [
        'Retry worktree branch mismatch.',
        `Expected ${execution.branch_name},`,
        `found ${branchResult.stdout}.`,
      ].join(' '),
    )
  }
}


function taskRetry() {
  if (!process.env.BS_OPERATION_ID) { taskSupervisor(); return }
  const [taskId] = args

  if (!validTaskId(taskId)) {
    output({
      ok: false,
      command:
        'task-retry',
      error:
        'valid_task_id_required',
    }, 64)

    return
  }

  let newExecutionId = null
  let prompt
  let logPath

  try {
    const packetResult =
      controlQuery(
        `
          SELECT COALESCE(
            control.generic_task_packet(
              :'task_id'
            ),
            'null'::jsonb
          );
        `,
        {
          task_id:
            taskId,
        },
      )

    const packet =
      parseControlJson(
        packetResult,
      )

    if (!packet) {
      throw new Error(
        `Unknown task: ${taskId}`,
      )
    }

    const runningExecution = latestExecution(taskId)
    const resumeExecution = runningExecution?.status === 'running' ? runningExecution : null
    if (packet.task.status !== 'failed' && !resumeExecution) {
      throw new Error(
        `Task ${taskId} is ${packet.task.status}, not failed.`,
      )
    }

    const previousExecution = resumeExecution ? currentExecution({ executions: supervisorSnapshot(taskId).executions.filter(e => e.attempt < resumeExecution.attempt) }) : latestExecution(taskId)

    if (!previousExecution) {
      throw new Error(
        'Task has no previous execution.',
      )
    }

    const executionPreflight = resumeExecution ? { ready: true } : runExecutionPreflight(
      supervisorSnapshot(taskId),
      retryPurpose(supervisorSnapshot(taskId)),
    )
    if (!executionPreflight.ready) {
      output({
        ok: false,
        command: 'task-retry',
        task_id: taskId,
        error: executionPreflight.reason,
        preflight: executionPreflight,
      }, 1)
      return
    }

    const retryPolicy =
      validateRetryPolicy(
        packet.retry_policy,
      )

    const decision =
      repairRetryDecision(
        retryPolicy,
        previousExecution,
        supervisorSnapshot(taskId).retry_accounting,
        resumeExecution,
      )

    if (!decision.allowed) {
      output({
        ok: false,

        command:
          'task-retry',

        task_id:
          taskId,

        error:
          'retry_limit_reached',

        previous_attempt:
          previousExecution.attempt,

        max_attempts:
          retryPolicy.max_attempts,

        retry_policy:
          retryPolicy,
      }, 1)

      return
    }

    validateRetryWorktree(
      previousExecution,
    )

    const nextProfile =
      decision.next_profile

    const route = resumeExecution ? { uses_codex: true, profile: resumeExecution.model_profile, model: resumeExecution.model_name, reasoning_effort: resumeExecution.reasoning_effort } : resolveCodexRoute(nextProfile)

    const persistedVerificationFailures =
      verificationFailures(
        previousExecution.execution_id,
      )

    const controlFailure =
      latestOpenControlFailure(
        taskId,
      )

    const failures = repairFailureChecks({
      execution: previousExecution,
      failure: controlFailure,
      formalChecks: persistedVerificationFailures,
    })

    const repairFailures =
      controlFailure?.failure_class === 'verification-product-defect'
        ? failures.filter(
            failure => failure.failure_class === 'verification-product-defect',
          )
        : failures

    if (
      previousExecution.status === 'succeeded' &&
      String(controlFailure?.failure_class ?? '').startsWith('verification-') &&
      controlFailure.failure_class !== 'verification-product-defect'
    ) {
      output({
        ok: false,
        command: 'task-retry',
        task_id: taskId,
        error: 'verification_failure_requires_same_execution_reverify',
        failure_class: controlFailure.failure_class,
        execution_id: previousExecution.execution_id,
      }, 1)
      return
    }

    const previousFailure =
      {
        execution_id:
          previousExecution.execution_id,

        attempt:
          previousExecution.attempt,

        execution_status:
          previousExecution.status,

        model_profile:
          previousExecution.model_profile,

        model_name:
          previousExecution.model_name,

        reasoning_effort:
          previousExecution.reasoning_effort,

        execution_error:
          previousExecution.metadata?.stderr ??
          null,

        verification_failures:
          repairFailures,

        control_failure:
          controlFailure,
      }

    const nextAttempt =
      previousExecution.attempt + 1

    const runDirectory =
      path.join(
        previousExecution.worktree_path,
        '.local',
        'agent-runs',
        taskId,
        `retry-${nextAttempt}`,
      )

    mkdirSync(
      runDirectory,
      {
        recursive: true,
      },
    )

    const failurePacketPath =
      path.join(
        runDirectory,
        'failure.json',
      )

    writeFileSync(
      failurePacketPath,
      `${JSON.stringify(
        previousFailure,
        null,
        2,
      )}\n`,
      {
        mode: 0o600,
      },
    )


    const taskPacketPath =
      path.join(
        previousExecution.worktree_path,
        '.local',
        'agent-tasks',
        `${taskId}.json`,
      )

    if (
      !existsSync(
        taskPacketPath,
      )
    ) {
      writeFileSync(
        taskPacketPath,
        `${JSON.stringify(
          packet,
          null,
          2,
        )}\n`,
        {
          mode: 0o600,
        },
      )
    }

    const isNoPublishableChanges =
      controlFailure?.stage ===
        'publication' &&
      controlFailure?.error_code ===
        'no_publishable_changes'


    const basePrompt =
      isNoPublishableChanges
        ? `
Continue ${packet.project?.display_name ?? 'registered project'} task ${taskId}.

The previous implementation completed successfully and independent verification passed, but publication found ZERO publishable Git changes.

This is an implementation retry, not a verification repair.

Read:
1. README.md
2. AGENTS.md
3. ${packet.workstream?.application_path ?? packet.suit.app_path}/AGENTS.md if it exists
4. docs/agent-workflows.md
5. ${taskPacketPath}
6. ${failurePacketPath}

Work in the existing task worktree.

Determine whether the task requirements and acceptance criteria are already genuinely satisfied by the existing parent code.

If implementation is still required:
- make the smallest correct implementation needed to satisfy the task;
- add or update appropriate focused tests when required;
- stay inside the approved task/workstream scope.

If the requested behavior is already completely implemented:
- do not create dummy files;
- do not manufacture a meaningless diff;
- return a concise evidence-based explanation that no code change is necessary.

Rules:
- Preserve already-correct work.
- Do not expand scope.
- Do not create another branch or worktree.
- Do not commit.
- Do not push.
- Do not merge.
- Do not deploy.
- Do not modify hosted databases.
- Leave final verification and publication to the control plane.

Return a concise implementation summary.
          `.trim()

        : `
Repair ${packet.project?.display_name ?? 'registered project'} task ${taskId}.

The previous implementation failed independent verification.

Read:
1. README.md
2. AGENTS.md
3. ${packet.workstream?.application_path ?? packet.suit.app_path}/AGENTS.md if it exists
4. docs/agent-workflows.md
5. ${taskPacketPath}
6. ${failurePacketPath}

Work in the existing task worktree.

Rules:
- Fix only the causes of the recorded failures.
- Preserve already-correct task work.
- Do not expand scope.
- Do not create another branch or worktree.
- Do not commit.
- Do not push.
- Do not merge.
- Do not deploy.
- Do not modify hosted databases.
- Use the failure summaries first.
- Inspect a referenced full log only when needed.
- Fix only the recorded verification failures without expanding task scope.
- Re-run every recorded failed verifier command exactly when it is locally safe.
- Do not report the repair complete while any recorded failed verifier command still fails.
- If that verifier command exposes another failure in the same regression suite, continue repairing that suite until the command exits successfully.
- Additional focused checks may be used for diagnosis, but they do not replace the failed verifier command.
- Never convert a required failed check into a skip or unconditional success.
- If a required local fixture is unavailable, report that prerequisite and preserve the required check.
- Independent final verification still belongs to the control plane.

Return a concise repair summary.
          `.trim()
    prompt = `${basePrompt}\n\nPersisted repair evidence:\n${repairEvidenceHeader(supervisorSnapshot(taskId), nextAttempt)}`


    const promptPath =
      path.join(
        runDirectory,
        'prompt.txt',
      )

    logPath =
      path.join(
        runDirectory,
        'codex.jsonl',
      )

    if (resumeExecution && existsSync(promptPath)) prompt = storedPrompt(readFileSync(promptPath, 'utf8'))
    writeFileSync(
      promptPath,
      `${prompt}\n`,
      {
        mode: 0o600,
      },
    )

    const retry =
      startRetryExecution(
        taskId,
        route,
        retryPolicy,
      )

    if (
      retry.allowed !== true
    ) {
      output({
        ok: false,

        command:
          'task-retry',

        task_id:
          taskId,

        error:
          retry.reason ??
          'retry_not_allowed',

        retry,
      }, 1)

      return
    }

    newExecutionId =
      retry.execution_id

    const startedAt =
      Date.now()

    const maxRepairCycles =
      1

    let currentRepairPrompt =
      prompt

    let repairCycles =
      0

    let totalPromptBytes =
      0

    let totalOutputBytes =
      0

    let lastExitCode =
      1

    let lastStderr =
      ''

    let latestProbe =
      null

    let latestProbePath =
      null

    let probePassed =
      false

    let succeeded =
      false

    const codexOutputs =
      []

    for (
      let cycle = 1;
      cycle <= maxRepairCycles;
      cycle++
    ) {

      repairCycles =
        cycle

      totalPromptBytes +=
        Buffer.byteLength(
          currentRepairPrompt,
          'utf8',
        )

      const codexResult =
        execute(
          'codex',
          [
            'exec',
            '--json',
            '--ephemeral',

            '--sandbox',
            'workspace-write',

            '-C',
            retry.worktree_path,

            '--model',
            route.model,

            '-c',
            `model_reasoning_effort="${route.reasoning_effort}"`,

            currentRepairPrompt,
          ],

          codexExecutionOptions({
            cwd:
              retry.worktree_path,

            timeout:
              45 * 60 * 1000,
          }),
        )

      lastExitCode =
        codexResult.code

      lastStderr =
        codexResult.stderr ?? ''

      const cycleOutput =
        codexResult.stdout ?? ''

      totalOutputBytes +=
        Buffer.byteLength(
          cycleOutput,
          'utf8',
        )

      codexOutputs.push(
        cycleOutput,
      )

      writeFileSync(
        logPath,
        `${codexOutputs.join('\n')}\n`,
        {
          mode:
            0o600,
        },
      )

      if (
        !successful(
          codexResult,
        )
      ) {
        break
      }

      const probeDirectory =
        path.join(
          runDirectory,
          `repair-verification-${cycle}`,
        )

      const probeResult =
        execute(
          process.execPath,
          [
            path.join(
              controlSourceRoot,
              'tooling',
              'control-plane',
              'runner',
              'task-verifier.mjs',
            ),

            retry.worktree_path,
            taskPacketPath,
            probeDirectory,
            'probe',
          ],
          {
            cwd:
              retry.worktree_path,

            timeout:
              60 * 60 * 1000,
          },
        )

      try {

        latestProbe =
          JSON.parse(
            probeResult.stdout,
          )

      }
      catch {

        latestProbe = {
          classification: { failure_class: 'verification-infrastructure', recovery_action: 'wait-external' },
          ok:
            false,

          passed:
            false,

          checks: [
            {
              name:
                'verifier-infrastructure',

              status:
                'fail',

              exit_code:
                probeResult.code,

              summary:
                probeResult.stderr ||
                probeResult.error ||
                probeResult.stdout ||
                'Repair verifier probe returned invalid output.',
            },
          ],
        }

      }

      latestProbePath =
        path.join(
          runDirectory,
          `repair-verification-${cycle}.json`,
        )

      writeFileSync(
        latestProbePath,
        `${JSON.stringify(
          latestProbe,
          null,
          2,
        )}\n`,
        {
          mode:
            0o600,
        },
      )

      if (
        latestProbe?.passed ===
        true
      ) {

        const confirmationDirectory =
          path.join(
            runDirectory,
            `repair-verification-${cycle}-confirmation`,
          )

        const confirmationResult =
          execute(
            process.execPath,
            [
              path.join(
                controlSourceRoot,
                'tooling',
                'control-plane',
                'runner',
                'task-verifier.mjs',
              ),

              retry.worktree_path,
              taskPacketPath,
              confirmationDirectory,
              'probe',
            ],
            {
              cwd:
                retry.worktree_path,

              timeout:
                60 * 60 * 1000,
            },
          )

        let confirmationProbe

        try {

          confirmationProbe =
            JSON.parse(
              confirmationResult.stdout,
            )

        }
        catch {

          confirmationProbe = {
            ok:
              false,

            passed:
              false,

            checks: [
              {
                name:
                  'verifier-infrastructure',

                status:
                  'fail',

                exit_code:
                  confirmationResult.code,

                summary:
                  confirmationResult.stderr ||
                  confirmationResult.error ||
                  confirmationResult.stdout ||
                  'Repair confirmation verifier returned invalid output.',
              },
            ],
          }

        }

        const confirmationProbePath =
          path.join(
            runDirectory,
            `repair-verification-${cycle}-confirmation.json`,
          )

        writeFileSync(
          confirmationProbePath,
          `${JSON.stringify(
            confirmationProbe,
            null,
            2,
          )}\n`,
          {
            mode:
              0o600,
          },
        )

        latestProbe =
          confirmationProbe

        latestProbePath =
          confirmationProbePath

        if (
          confirmationProbe?.passed ===
          true
        ) {

          probePassed =
            true

          succeeded =
            true

          break
        }

      }

      if (
        cycle ===
        maxRepairCycles
      ) {
        break
      }

      const failedProbeChecks =
        Array.isArray(
          latestProbe?.checks,
        )
          ? latestProbe.checks
              .filter(
                check =>
                  ![
                    'pass',
                    'skipped',
                  ].includes(
                    check.status,
                  ),
              )
              .map(
                check => ({
                  name:
                    check.name,

                  status:
                    check.status,

                  exit_code:
                    check.exit_code,

                  summary:
                    check.summary,

                  log_path:
                    check.log_path,
                }),
              )
          : []

      currentRepairPrompt =
        `
Continue repairing ${packet.project?.display_name ?? 'registered project'} task ${taskId}.

This is still repair attempt ${retry.attempt}. Do not create a new task attempt.

The control-plane verifier probe still fails after repair cycle ${cycle}.

Read:
1. ${taskPacketPath}
2. ${latestProbePath}

Current failing checks:
${JSON.stringify(failedProbeChecks, null, 2)}

Rules:
- Fix only the currently recorded verifier failures.
- Preserve already-correct work.
- Do not expand scope.
- Do not create another branch or worktree.
- Do not commit.
- Do not push.
- Do not merge.
- Do not deploy.
- Do not modify hosted databases.
- Inspect the full referenced verifier logs when the summary is insufficient.
- If a suite exposes another failure after the first repair, continue repairing that same suite.
- Do not report success merely because a code change looks correct.
- The complete verifier probe must return passed=true before this repair can be accepted.

Return a concise repair summary.
        `.trim()

    }

    const elapsedMs =
      Date.now() -
      startedAt

    const finalExitCode =
      succeeded
        ? 0
        : (
            lastExitCode === 0
              ? 1
              : lastExitCode
          )

    if (!succeeded && (lastExitCode !== 0 || latestProbe?.classification?.failure_class && latestProbe.classification.failure_class !== 'verification-product-defect')) {
      const classification = latestProbe?.classification ?? workerProcessClassification({code:lastExitCode,stderr:lastStderr,stdout:codexOutputs.join('\n')})
      output({ ok: false, command: 'task-retry', task_id: taskId, execution_id: newExecutionId,
        error: latestProbe ? 'repair_verifier_recovery_required' : 'worker_process_interrupted', classification,
        probe: latestProbe, execution: { log_path: logPath } }, 1)
      return
    }
    finishExecution({
      executionId:
        newExecutionId,

      status:
        succeeded
          ? 'succeeded'
          : 'failed',

      promptBytes:
        totalPromptBytes,

      outputBytes:
        totalOutputBytes,

      runLogPath:
        logPath,

      metadata: {
        retry:
          true,

        previous_execution_id:
          previousExecution.execution_id,

        elapsed_ms:
          elapsedMs,

        exit_code:
          finalExitCode,

        stderr:
          lastStderr
            ? lastStderr.slice(
                0,
                4000,
              )
            : (
                succeeded
                  ? ''
                  : 'repair_verification_failed'
              ),

        repair_cycles:
          repairCycles,

        verification_probe_classification: latestProbe?.classification ?? null,
        verification_probe_verified_state: latestProbe?.verified_state ?? null,
        verification_probe_passed:
          probePassed,

        verification_probe_path:
          latestProbePath,

        verification_probe_failures:
          Array.isArray(
            latestProbe?.checks,
          )
            ? latestProbe.checks
                .filter(
                  check =>
                    ![
                      'pass',
                      'skipped',
                    ].includes(
                      check.status,
                    ),
                )
                .map(
                  check => ({
                    name:
                      check.name,

                    status:
                      check.status,

                    exit_code:
                      check.exit_code,

                    summary:
                      check.summary,

                    log_path:
                      check.log_path,
                    failure_class: check.failure_class ?? latestProbe?.classification?.failure_class ?? null,
                  }),
                )
            : [],
      },
    })


    const repairFailureClassification =
      !succeeded
        ? (
            latestProbe?.classification?.failure_class
              ? latestProbe.classification
              : (() => {
                  const workerFailure = classifySupervisorFailure({
                    command: 'task-retry',
                    payload: { error: lastStderr || latestProbe?.error || 'repair_worker_failed' },
                    attempt: previousExecution.attempt + 1,
                    maxAttempts: retryPolicy.max_attempts,
                  })
                  return { failure_class: workerFailure.failure_class, recovery_action: workerFailure.next_action }
                })()
          )
        : null

    if (!succeeded) {

      recordControlFailure(
        taskId,
        'repair',
        'repair_verification_failed',
        {
          classification:
            repairFailureClassification,

          repair_cycles:
            repairCycles,

          verification_probe_path:
            latestProbePath,

          verification_probe:
            latestProbe,
        },
      )

    }

    output({
      ok:
        succeeded,

      error:
        succeeded
          ? null
          : 'repair_verification_failed',

      classification:
        repairFailureClassification,

      command:
        'task-retry',

      task_id:
        taskId,

      previous_execution_id:
        previousExecution.execution_id,

      execution_id:
        newExecutionId,

      attempt:
        retry.attempt,

      route: {
        profile:
          route.profile,

        model:
          route.model,

        reasoning_effort:
          route.reasoning_effort,
      },

      execution: {
        exit_code:
          finalExitCode,

        elapsed_ms:
          elapsedMs,

        log_path:
          logPath,

        repair_cycles:
          repairCycles,

        verification_probe_classification: latestProbe?.classification ?? null,
        verification_probe_verified_state: latestProbe?.verified_state ?? null,
        verification_probe_passed:
          probePassed,

        verification_probe_path:
          latestProbePath,
      },
    }, succeeded ? 0 : 1)

  }
  catch (error) {

    const failureClass = isControlDatabaseConnectivityError(error) || newExecutionId ? 'transient-infrastructure' : 'safety-stop'

    output({
      ok: false,

      command: 'task-retry', task_id: taskId, execution_id: newExecutionId, error: error.message,
      classification: { failure_class: failureClass, recovery_action: failureClass === 'safety-stop' ? 'safety-stop' : 'wait-external' },
    }, 1)
  }
}

function taskMetadata(
  taskId,
) {
  const result =
    controlQuery(
      `
        SELECT COALESCE(
          metadata,
          '{}'::jsonb
        )
        FROM control.tasks
        WHERE task_id =
          :'task_id';
      `,
      {
        task_id:
          taskId,
      },
    )

  return (
    parseControlJson(
      result,
    ) ?? {}
  )
}

function publicationVerification(
  executionId,
) {
  const result =
    controlQuery(
      `
        WITH latest_run AS (
          SELECT *
          FROM control.verification_runs
          WHERE execution_id = :'execution_id'::bigint
          ORDER BY verification_run_id DESC
          LIMIT 1
        )
        SELECT COALESCE((
          SELECT jsonb_build_object(
            'verification_run_id', run.verification_run_id,
            'publication_execution_eligible', control.publication_execution_is_eligible((SELECT task_id FROM control.executions WHERE execution_id=run.execution_id),run.execution_id),
            'execution_id', run.execution_id,
            'status', run.status,
            'state_fingerprint', run.metadata->'verified_state'->>'fingerprint',
            'verified_state', run.metadata->'verified_state',
            'checks', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
              'check_name',
                check_name,

              'status',
                status,

              'exit_code',
                exit_code,

              'summary',
                summary
              ) ORDER BY verification_id)
              FROM control.verification_results
              WHERE verification_run_id = run.verification_run_id
            ), '[]'::jsonb)
          )
          FROM latest_run run
        ), 'null'::jsonb);
      `,
      {
        execution_id:
          String(
            executionId,
          ),
      },
    )

  return (
    parseControlJson(
      result,
      ) ?? null
  )
}

function completePublication({
  taskId,
  publication,
  repository,
}) {
  const result =
    controlQuery(
      `
        SELECT
          control.complete_publication(
            :'task_id',
            :'repository',
            :'pr_number'::integer,
            :'head_branch',
            :'base_branch',
            :'url',
            :'head_sha',
            :'is_draft'::boolean,
            :'metadata'::jsonb
          );
      `,
      {
        task_id:
          taskId,

        repository:
          repository,

        pr_number:
          String(
            publication.pr.number,
          ),

        head_branch:
          publication.pr.head_branch,

        base_branch:
          publication.pr.base_branch,

        url:
          publication.pr.url,

        head_sha:
          publication.commit_sha,

        is_draft:
          publication.pr.is_draft
            ? 'true'
            : 'false',

        metadata:
          JSON.stringify({
            pr_check:
              publication.pr_check,

            changed_files:
              publication.changed_files,

            verification_run_id:
              publication.verification_run_id,

            reconciliation:
              publication.reconciliation,

            publication_preflight:
              publication.preflight,
          }),
      },
    )

  return parseControlJson(
    result,
  )
}

function taskPublish() {
  if (!process.env.BS_OPERATION_ID) { taskSupervisor(); return }
  const [taskId] = args

  if (!validTaskId(taskId)) {
    output({
      ok: false,
      command:
        'task-publish',
      error:
        'valid_task_id_required',
    }, 64)

    return
  }

  try {

    const packetResult =
      controlQuery(
        `
          SELECT COALESCE(
            control.generic_task_packet(
              :'task_id'
            ),
            'null'::jsonb
          );
        `,
        {
          task_id:
            taskId,
        },
      )


    const packet =
      parseControlJson(
        packetResult,
      )


    if (!packet) {
      throw new Error(
        `Unknown task: ${taskId}`,
      )
    }


    if (
      packet.task.status !==
      'passed'
    ) {
      throw new Error(
        `Task ${taskId} is ${packet.task.status}, not passed.`,
      )
    }


    const execution =
      latestExecution(
        taskId,
      )


    if (!execution) {
      throw new Error(
        'Task has no execution.',
      )
    }


    const verification =
      publicationVerification(
        execution.execution_id,
      )


    if (
      !verification
    ) {
      throw new Error(
        'Task has no verification evidence.',
      )
    }

    if (execution.status !== 'succeeded' && verification.publication_execution_eligible !== true) {
      throw new Error('Latest execution lacks successful implementation or exact guarded reacceptance.')
    }

    if (verification.status !== 'passed') {
      throw new Error(
        'Latest authoritative verification run is not passed.',
      )
    }


    const blockingVerification =
      verification.checks.filter(
        check =>
          check.status === 'fail' ||
          check.status === 'not_run' ||
          check.status === 'queued' ||
          check.status === 'running',
      )


    if (
      blockingVerification.length > 0
    ) {
      throw new Error(
        'Task has blocking verification results.',
      )
    }

    const prePublicationVerificationConfig =
      mergeVerificationConfig(
        packet.project?.verification_config,
        packet.workstream?.verification_config,
      )

    const prePublicationPlan =
      resolveVerificationPlan({
        entries: packet.task?.verification_plan ?? [],
        configuredCommands: prePublicationVerificationConfig.commands ?? [],
        legacyMappings: prePublicationVerificationConfig.legacy_plan_mappings ?? {},
        phase: 'pre_publication',
      })

    const prePublicationGates =
      prePublicationPlan.blockers.filter(
        blocker =>
          blocker.phase === 'pre_publication' &&
          blocker.required !== false,
      )

    if (prePublicationGates.length > 0) {
      const classification = {
        failure_class: 'operator-wait',
        recovery_action: 'wait-operator',
      }

      recordControlFailure(
        taskId,
        'publication',
        'prepublication_external_verification_required',
        {
          classification,
          gates: prePublicationGates,
        },
      )

      output({
        ok: false,
        command: 'task-publish',
        task_id: taskId,
        error: 'prepublication_external_verification_required',
        classification,
        gates: prePublicationGates,
      }, 1)

      return
    }

    const runPublicationAuthority = parseControlJson(controlQuery(`SELECT control.current_run_publication_authority(:'task_id');`, { task_id: taskId }))
    const publicationHold = publicationHoldOutcome(process.env, runPublicationAuthority, taskId)
    if (publicationHold) {
      recordControlFailure(taskId, 'publication', publicationHold.error, publicationHold)
      output({ ...publicationHold, command: 'task-publish', task_id: taskId }, 1)
      return
    }


    const metadata =
      taskMetadata(
        taskId,
      )


    const configuredAllowedPaths =
      Array.isArray(
        metadata.allowed_paths,
      )
        ? metadata.allowed_paths
        : []

    const sourceAllowedPaths =
      Array.isArray(
        metadata.source_allowed_paths,
      )
        ? metadata.source_allowed_paths
        : []


    const workstreamApplicationPath =
      packet.workstream?.application_path ??
      packet.suit.app_path ??
      null


    const workstreamAllowedPaths =
      workstreamApplicationPath
        ? [
            `${workstreamApplicationPath}/`,
          ]
        : []


    const explicitTaskAllowedPaths =
      configuredAllowedPaths


    const projectAllowedPaths =
      Array.isArray(
        packet.project
          ?.allowed_publication_paths,
      )
        ? packet.project
            .allowed_publication_paths
        : []


    const allowedPaths =
      [
        ...new Set([
          ...workstreamAllowedPaths,
          ...explicitTaskAllowedPaths,
        ]),
      ]


    if (
      allowedPaths.length === 0
    ) {
      throw new Error(
        'No publication scope is configured.',
      )
    }


    const publicationDirectory =
      path.join(
        execution.worktree_path,
        '.local',
        'agent-runs',
        taskId,
        'publication',
      )


    mkdirSync(
      publicationDirectory,
      {
        recursive: true,
      },
    )


    const contextPath =
      path.join(
        publicationDirectory,
        'context.json',
      )


    writeFileSync(
      contextPath,

      `${JSON.stringify(
        {
          task:
            packet.task,

          suit:
            packet.suit,

          project:
            packet.project,

          workstream:
            packet.workstream,

          execution,

          allowed_paths:
            allowedPaths,

          requirements:
            packet.requirements,

          verification,

          publication_boundaries: {
            task_paths: configuredAllowedPaths,
            source_paths: sourceAllowedPaths,
            workstream_paths: workstreamAllowedPaths,
            project_paths: projectAllowedPaths,
          },

          publication_contract:
            packet.publication_contract,

          run_publication_authority: runPublicationAuthority,
          publication_authorizations:
            packet.publication_authorizations,
        },
        null,
        2,
      )}\n`,

      {
        mode: 0o600,
      },
    )


    const publisher =
      execute(
        process.execPath,
        [
          path.join(
            controlSourceRoot,
            'tooling',
            'control-plane',
            'runner',
            'task-publisher.mjs',
          ),

          contextPath,
        ],
        {
          cwd:
            execution.worktree_path,

          timeout:
            20 * 60 * 1000,
        },
      )


    let publication

    try {
      publication =
        JSON.parse(
          publisher.stdout,
        )
    }
    catch {
      throw new Error(
        publisher.stderr ||
        publisher.error ||
        publisher.stdout ||
        'Publisher returned invalid JSON.',
      )
    }


    if (
      !publication.ok
    ) {
      recordControlFailure(
        taskId,
        'publication',
        publication.error ?? 'publication_failed',
        publication,
      )
      output({
        ok: false,

        command:
          'task-publish',

        task_id:
          taskId,

        publication,
      }, 1)

      return
    }


    const recorded =
      completePublication({
        taskId,
        publication,
        repository:
          packet.project?.github_repository ??
          githubRepository,
      })


    output({
      ok: true,

      command:
        'task-publish',

      task_id:
        taskId,

      publication,

      control:
        recorded,
    })
  }
  catch (error) {

    recordControlFailure(
      taskId,
      'publication',
      error.message,
    )

    output({
      ok: false,

      command:
        'task-publish',

      task_id:
        taskId,

      error:
        error.message,
    }, 1)

  }
}


const agentScriptPath =
  fileURLToPath(
    import.meta.url,
  )


function engineTaskPacket(taskId) {
  const result =
    controlQuery(
      `
        SELECT COALESCE(
          control.generic_task_packet(
            :'task_id'
          ),
          'null'::jsonb
        );
      `,
      {
        task_id:
          taskId,
      },
    )

  return parseControlJson(
    result,
  )
}


function invokeTaskAction(action, taskId) {
  if (!['task-run','task-retry','task-verify','task-publish','task-prepare','task-reaccept'].includes(action)) {
    const result = execute(process.execPath, [agentScriptPath, action, taskId], { cwd: repoRoot, timeout: 70 * 60_000 })
    return { result, payload: parseJson(result.stdout, null) }
  }
  const snapshot = supervisorSnapshot(taskId)
  const existing = snapshot.runtime_operations?.find(op => op.status !== 'consumed')
  const claimed = existing ? { acquired: true, operation: existing } : parseControlJson(controlQuery(
    `SELECT control.claim_runtime_operation(:'task_id', :'action', NULLIF(:'execution_id','')::bigint, :'descriptor'::jsonb, :'owner', :'token');`,
    { task_id: taskId, action, execution_id: String(currentExecution(snapshot)?.execution_id ?? ''),
      descriptor: JSON.stringify({ source: agentScriptPath, previous_execution_id: currentExecution(snapshot)?.execution_id ?? null }), owner: `${process.pid}@local`, token: randomUUID() },
  ))
  if (!claimed.acquired) return { result: { code: 0 }, payload: { ok: false, error: claimed.reason, classification: { failure_class: 'operator-wait', recovery_action: 'wait-operator' } } }
  const op = claimed.operation
  if (operationHasAuthoritativeSuccess(snapshot, op)) {
    const payload = { ok: true, command: op.action, replayed_authoritative_state: true }
    controlQuery(`UPDATE control.runtime_operations SET status='consumed',result=:'result'::jsonb,updated_at=now() WHERE operation_id=:'id'::uuid;`, { id: op.operation_id, result: JSON.stringify(payload) })
    return { result: { code: 0 }, payload }
  }
  if (Date.parse(op.next_wake_at) > Date.now()) return { result: { code: 0 }, payload: { ok: false, error: 'runtime_backoff_pending', classification: { failure_class: 'transient-infrastructure', recovery_action: 'wait-external' } } }
  const reserved = snapshot.executions?.find(e => e.execution_id === op.execution_id)
  const completedVerification = snapshot.verification_runs?.filter(v => v.execution_id === op.execution_id && v.status !== 'running').at(-1)
  const phaseSettled = ['task-run','task-retry'].includes(op.action) && reserved && !['running','queued'].includes(reserved.status) && reserved.execution_id !== op.descriptor?.previous_execution_id
    || op.action === 'task-verify' && completedVerification && ['passed','failed'].includes(snapshot.packet.task.status) && !requiresSameAttemptVerification(snapshot,op)
  if (phaseSettled) {
    const failure = snapshot.failures?.filter(f => f.execution_id === op.execution_id && !f.resolved_at).at(-1)
    const passed = op.action === 'task-verify' ? completedVerification.status === 'passed' : reserved.status === 'succeeded'
    const classification = failure?.metadata?.classification ?? reserved?.metadata?.verification_probe_classification ?? { failure_class: 'safety-stop', recovery_action: 'safety-stop' }
    const payload = { ok: passed, execution_id: op.execution_id, command: op.action, replayed_authoritative_state: true, classification: passed ? null : classification, error: passed ? null : 'authoritative_phase_failed' }
    // Infrastructure formal failures need reverify, rather than replay forever.
    if (!retryWithoutProductAttempt(classification) || passed) {
      controlQuery(`UPDATE control.runtime_operations SET status='consumed',result=:'result'::jsonb,updated_at=now() WHERE operation_id=:'id'::uuid;`, { id: op.operation_id, result: JSON.stringify(payload) })
      return { result: { code: passed ? 0 : 1 }, payload }
    }
  }
  const paths = receiptPaths(path.join(repoRoot, '.local', 'runtime-operations'), op.operation_id, op.infra_retries)
  if (['task-run','task-retry'].includes(op.action) && recoverInterruptedHandoff(path.join(repoRoot, '.local', 'runtime-receipts'), op.operation_id, paths)) {
    return { result: { code: 0 }, payload: { ok: false, error: 'worker_transport_interrupted', classification: { failure_class: 'transient-infrastructure', recovery_action: 'wait-external', component: 'worker-transport' }, operation_id: op.operation_id } }
  }
  startReceipt(paths, { program: process.execPath, args: [agentScriptPath, op.action, taskId], cwd: repoRoot, timeout: 70 * 60_000 }, { ...process.env, BS_OPERATION_ID: op.operation_id, BS_OPERATION_INFRA_GENERATION: String(op.infra_retries) })
  // A short polling boundary lets n8n return while detached worker survives SSH.
  let result = readJson(paths.result)
  if (!result) return { result: { code: 0 }, payload: { ok: false, error: 'runtime_operation_in_flight', classification: { failure_class: 'transient-infrastructure', recovery_action: 'wait-external' }, operation_id: op.operation_id } }
  const payload = parseJson(result.stdout, null) ?? { ok: false, error: 'malformed_child_response', classification: { failure_class: 'transient-infrastructure', recovery_action: 'wait-external' } }
  const automatic = payload.ok !== true && retryWithoutProductAttempt(payload.classification)
  controlQuery(`UPDATE control.runtime_operations SET status=:'status', result=:'result'::jsonb,
    infra_retries=infra_retries+:'increment'::integer, next_wake_at=now()+(:'backoff'::integer*interval '1 millisecond'),
    execution_id=(SELECT execution_id FROM control.executions WHERE task_id=:'task_id' ORDER BY attempt DESC LIMIT 1),
    lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE operation_id=:'id'::uuid;`,
    { status: automatic ? 'pending' : 'consumed', result: JSON.stringify({ result, payload }), increment: automatic ? '1' : '0', backoff: String(automatic ? recoveryBackoff(op.infra_retries) : 0), task_id: taskId, id: op.operation_id })
  return { result, payload }
}


function handleNoPublishableChanges(
  taskId,
) {
  const result =
    controlQuery(
      `
        SELECT
          control.handle_no_publishable_changes(
            :'task_id',
            'runner'
          );
      `,
      {
        task_id:
          taskId,
      },
    )


  return parseControlJson(
    result,
  )
}


export function supervisorSnapshot(taskId) {
  const result = controlQuery(
    `
      SELECT jsonb_build_object(
        'packet', control.generic_task_packet(:'task_id'),
        'retry_accounting', CASE WHEN control.resolved_retry_policy(:'task_id')->>'policy_id'='shared-foundation-five' THEN control.product_retry_accounting(:'task_id') ELSE NULL END,
        'executions', COALESCE((
          SELECT jsonb_agg(to_jsonb(e) ORDER BY e.attempt)
          FROM control.executions e
          WHERE e.task_id = :'task_id'
        ), '[]'::jsonb),
        'verification_runs', COALESCE((
          SELECT jsonb_agg(to_jsonb(vr) ORDER BY vr.verification_run_id)
          FROM control.verification_runs vr
          JOIN control.executions e USING (execution_id)
          WHERE e.task_id = :'task_id'
        ), '[]'::jsonb),
        'verification_results', COALESCE((
          SELECT jsonb_agg(to_jsonb(v) ORDER BY v.verification_id)
          FROM control.verification_results v
          JOIN control.executions e USING (execution_id)
          WHERE e.task_id = :'task_id'
        ), '[]'::jsonb),
        'failures', COALESCE((
          SELECT jsonb_agg(to_jsonb(f) ORDER BY f.failure_id)
          FROM control.failures f
          WHERE f.task_id = :'task_id'
        ), '[]'::jsonb),
        'publications', COALESCE((
          SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.pull_request_id)
          FROM control.pull_requests pr
          WHERE pr.task_id = :'task_id'
        ), '[]'::jsonb),
        'serialization_conflicts', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'task_id', other.task_id,
            'status', other.status,
            'engine_stage', other.engine_stage
          ) ORDER BY other.task_id)
          FROM control.tasks target
          JOIN control.tasks other
            ON other.project_id = target.project_id
           AND other.workstream_slug = target.workstream_slug
           AND other.task_id <> target.task_id
          WHERE target.task_id = :'task_id'
            AND other.status IN ('in_progress', 'verification', 'passed', 'failed')
        ), '[]'::jsonb),
        'run_publication_authority', control.current_run_publication_authority(:'task_id'),
        'workflow_run', (SELECT to_jsonb(r) FROM control.workflow_runs r WHERE current_task_id=:'task_id' ORDER BY started_at DESC LIMIT 1),
        'runtime_operations', COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY created_at) FROM control.runtime_operations o WHERE task_id=:'task_id' AND status<>'consumed'),'[]'::jsonb),
        'recovery', control.current_task_recovery_condition(:'task_id')
      );
    `,
    { task_id: taskId },
  )

  const snapshot=parseControlJson(result)
  if(snapshot) snapshot.binding_recovery=strictBindingRecoveryEvidence(snapshot)
  return snapshot
}


function parentSatisfactionSourceEvidence(contract) {
  if (!validTaskId(contract?.source_task_id)) return null
  const result = controlQuery(
    `
      WITH selected_run AS (
        SELECT vr.*
        FROM control.verification_runs vr
        JOIN control.executions e USING (execution_id)
        WHERE e.task_id = :'source_task_id'
          AND vr.status = 'passed'
          AND (
            NULLIF(:'verification_run_id', '')::bigint IS NULL
            OR vr.verification_run_id = NULLIF(:'verification_run_id', '')::bigint
          )
        ORDER BY vr.verification_run_id DESC
        LIMIT 1
      )
      SELECT COALESCE((
        SELECT jsonb_build_object(
          'task_id', t.task_id,
          'task_status', t.status,
          'execution_id', e.execution_id,
          'execution_status', e.status,
          'commit_sha', e.commit_sha,
          'lineage_sha', CASE
            WHEN pr.state = 'merged'
              AND pr.head_sha = e.commit_sha
              AND pr.merge_sha IS NOT NULL
            THEN pr.merge_sha
            ELSE e.commit_sha
          END,
          'publication_state', pr.state,
          'publication_head_sha', pr.head_sha,
          'publication_merge_sha', pr.merge_sha,
          'verification_run_id', vr.verification_run_id,
          'verification_status', vr.status,
          'checks', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'check_name', v.check_name,
              'command', v.command,
              'status', v.status,
              'exit_code', v.exit_code,
              'summary', v.summary,
              'required', COALESCE((v.metadata->>'required')::boolean, true)
            ) ORDER BY v.verification_id)
            FROM control.verification_results v
            WHERE v.verification_run_id = vr.verification_run_id
          ), '[]'::jsonb)
        )
        FROM selected_run vr
        JOIN control.executions e USING (execution_id)
        JOIN control.tasks t ON t.task_id = e.task_id
        LEFT JOIN LATERAL (
          SELECT state, head_sha, merge_sha
          FROM control.pull_requests
          WHERE task_id = t.task_id
          ORDER BY pull_request_id DESC
          LIMIT 1
        ) pr ON true
      ), 'null'::jsonb);
    `,
    {
      source_task_id: contract.source_task_id,
      verification_run_id: String(contract.verification_run_id ?? ''),
    },
  )
  return parseControlJson(result)
}


function recordParentSatisfactionEvaluation(taskId, evaluation) {
  const result = controlQuery(
    `
      SELECT control.record_parent_satisfaction_evaluation(
        :'task_id', :'fingerprint', :'evidence'::jsonb, 'runner'
      );
    `,
    {
      task_id: taskId,
      fingerprint: evaluation.fingerprint,
      evidence: JSON.stringify(evaluation),
    },
  )
  return parseControlJson(result)
}


function evaluateSupervisorParentSatisfaction(snapshot) {
  const task = snapshot.packet?.task
  if (task?.status !== 'in_progress' || (snapshot.executions ?? []).length > 0) return snapshot

  const project = projectRuntime(snapshot.packet)
  let parent = null
  try {
    parent = resolveStackParent(snapshot.packet.suit.stack_key, project)
  }
  catch {
    // The evaluator records an unavailable parent and lets execution preflight
    // provide the authoritative repository recovery route.
  }

  const expectedBranch = `codex/${snapshot.packet.suit.stack_key}/${task.task_id.toLowerCase()}`
  const repositoryRoot = path.resolve(repoRoot, project.repository_root)
  const localBranch = gitCheck(repositoryRoot, [
    'show-ref', '--verify', '--quiet', `refs/heads/${expectedBranch}`,
  ]).ok
  const remoteBranch = gitCheck(repositoryRoot, [
    'show-ref', '--verify', '--quiet', `refs/remotes/origin/${expectedBranch}`,
  ]).ok
  const sourceEvidence = parentSatisfactionSourceEvidence(task.parent_satisfaction)
  const sourceCommitInParent = Boolean(
    sourceEvidence?.lineage_sha && parent?.parent_sha &&
    gitCheck(repositoryRoot, [
      'merge-base', '--is-ancestor', sourceEvidence.lineage_sha, parent.parent_sha,
    ]).ok,
  )
  const evaluation = evaluateParentSatisfaction({
    packet: snapshot.packet,
    parent,
    taskLineage: {
      local_branch: localBranch,
      remote_branch: remoteBranch,
      pull_request: parent?.parent_branch === expectedBranch ? parent.parent_pr : null,
    },
    sourceEvidence,
    sourceCommitInParent,
    executions: snapshot.executions,
    publications: snapshot.publications,
  })

  recordParentSatisfactionEvaluation(task.task_id, evaluation)
  return { ...snapshot, parent_satisfaction: evaluation }
}


function completeParentSatisfied(taskId, evaluation) {
  const result = controlQuery(
    `
      SELECT control.complete_parent_satisfied(
        :'task_id', :'fingerprint', 'runner'
      );
    `,
    { task_id: taskId, fingerprint: evaluation.fingerprint },
  )
  return parseControlJson(result)
}


function gitCheck(cwd, gitArgs) {
  const result = execute('git', gitArgs, { cwd })
  return {
    ok: successful(result),
    value: successful(result) ? result.stdout : null,
  }
}


function executableAvailable(program) {
  return successful(execute('sh', ['-c', 'command -v "$1" >/dev/null 2>&1', 'sh', program]))
}


export function executionPreflightRuntime(snapshot) {
  const packet = snapshot.packet
  const project = projectRuntime(packet)
  const repositoryRoot = path.resolve(repoRoot, project.repository_root)
  const identityResult = controlQuery(`
    SELECT jsonb_build_object(
      'database', current_database(),
      'user', current_user,
      'server_address', COALESCE(inet_server_addr()::text, 'local-socket'),
      'server_port', inet_server_port(),
      'server_version_num', current_setting('server_version_num'),
      'control_schema', to_regnamespace('control')::text,
      'task_packet_contract', to_regprocedure('control.generic_task_packet(text)')::text
    );
  `)
  const identity = parseControlJson(identityResult)
  const actualDatabaseFingerprint = preflightFingerprint(identity)
  const expectedDatabaseFingerprint =
    process.env.AUTOMATION_CONTROL_DB_FINGERPRINT ??
    packet.project?.environment_routing?.control_database_fingerprint ??
    null

  let parent = null
  let parentError = null
  try {
    parent = packet.preparation?.parent ?? resolveStackParent(packet.suit.stack_key, project)
  }
  catch (error) {
    parentError = error.message
  }

  const root = gitCheck(repositoryRoot, ['rev-parse', '--show-toplevel'])
  const integration = gitCheck(repositoryRoot, ['rev-parse', `origin/${project.integration_branch}`])
  const integrationPresent = integration.ok
    ? gitCheck(repositoryRoot, ['cat-file', '-e', `${integration.value}^{commit}`]).ok
    : false
  const parentPresent = parent?.parent_sha
    ? gitCheck(repositoryRoot, ['cat-file', '-e', `${parent.parent_sha}^{commit}`]).ok
    : false
  const parentRemoteSha = parent?.parent_remote_ref
    ? gitCheck(repositoryRoot, ['rev-parse', parent.parent_remote_ref])
    : { ok: false, value: null }
  const parentPrConsistent = !parent?.parent_pr || (
    parent.parent_type === 'stack_leaf' &&
    parent.parent_pr.number > 0 &&
    (
      parent.parent_pr.base_branch === project.integration_branch ||
      parent.parent_pr.base_branch.startsWith(`codex/${packet.suit.stack_key}/`)
    )
  )
  const parentConsistent = Boolean(
    parent && parentPresent && parentRemoteSha.ok &&
    (parentRemoteSha.value === parent.parent_sha || parentContinuation({sameBranch:true,oldPresent:parentPresent,newPresent:gitCheck(repositoryRoot,['cat-file','-e',`${parentRemoteSha.value}^{commit}`]).ok,ancestor:gitCheck(repositoryRoot,['merge-base','--is-ancestor',parent.parent_sha,parentRemoteSha.value]).ok,containsOld:true}).safe) && parentPrConsistent,
  )

  const expectedBranch = `codex/${packet.suit.stack_key}/${packet.task.task_id.toLowerCase()}`
  const preparedWorktree = packet.preparation?.worktree
  let worktreeTarget
  if (preparedWorktree) {
    const targetPath = preparedWorktree.worktree_path
    const branch = existsSync(targetPath)
      ? gitCheck(targetPath, ['branch', '--show-current'])
      : { ok: false, value: null }
    const containsParent = existsSync(targetPath) && parent?.parent_sha
      ? gitCheck(targetPath, ['merge-base', '--is-ancestor', parent.parent_sha, 'HEAD']).ok
      : false
    const trackedChanges = existsSync(targetPath)
      ? gitCheck(targetPath, ['diff', '--name-only', 'HEAD']).value?.split('\n').filter(Boolean) ?? []
      : []
    const untrackedChanges = existsSync(targetPath)
      ? gitCheck(targetPath, ['ls-files', '--others', '--exclude-standard']).value?.split('\n').filter(Boolean) ?? []
      : []
    const changedFiles = [...new Set([...trackedChanges, ...untrackedChanges])].sort()
    worktreeTarget = {
      path: targetPath,
      branch: branch.value,
      changed_files: changedFiles,
      status: !existsSync(targetPath) ? 'missing' : !branch.ok
        ? 'invalid'
        : branch.value !== expectedBranch || preparedWorktree.branch_name !== expectedBranch || !containsParent
          ? 'stale'
          : 'ready',
    }
  }
  else {
    const targetPath = path.join(
      path.resolve(repositoryRoot, project.worktree_root),
      `${packet.suit.stack_key}-${packet.task.task_id.toLowerCase()}`,
    )
    const branchExists = gitCheck(repositoryRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${expectedBranch}`]).ok
    worktreeTarget = {
      path: targetPath,
      branch: expectedBranch,
      changed_files: [],
      status: existsSync(targetPath) || branchExists ? 'invalid' : 'missing',
    }
  }

  const requiredPrograms = new Set(['node', 'git', 'gh', 'psql', 'pnpm', 'codex'])
  for (const config of [packet.project?.verification_config, packet.workstream?.verification_config]) {
    for (const check of config?.commands ?? []) {
      if (check?.required !== false && check?.program) requiredPrograms.add(check.program)
    }
    for (const phase of ['start_commands', 'reset_commands', 'test_commands']) {
      for (const check of config?.database?.[phase] ?? []) {
        if (check?.required !== false && check?.program) requiredPrograms.add(check.program)
      }
    }
  }
  const executables = Object.fromEntries(
    [...requiredPrograms].sort().map(program => [program, executableAvailable(program)]),
  )
  const missingEnvironment = []
  if (!expectedDatabaseFingerprint) missingEnvironment.push('AUTOMATION_CONTROL_DB_FINGERPRINT')
  if (Number(process.versions.node.split('.')[0]) < 22) missingEnvironment.push('node>=22')
  if (!packet.project?.github_repository) missingEnvironment.push('project.github_repository')
  if (!packet.project?.integration_branch) missingEnvironment.push('project.integration_branch')
  if (!packet.project?.local_repository_root) missingEnvironment.push('project.local_repository_root')
  if (!packet.project?.worktree_root) missingEnvironment.push('project.worktree_root')

  return {
    control_database: {
      identity,
      actual_fingerprint: actualDatabaseFingerprint,
      expected_fingerprint: expectedDatabaseFingerprint,
    },
    repository: {
      root: root.value,
      root_valid: root.ok && path.resolve(root.value) === path.resolve(repositoryRoot),
      integration_sha: integration.value,
      integration_commit_present: integrationPresent,
      parent,
      parent_error: parentError,
      parent_commit_present: parentPresent,
      parent_consistent: parentConsistent,
      worktree_target: worktreeTarget,
      dependencies_ready: worktreeTarget.status === 'ready' && existsSync(path.join(worktreeTarget.path, 'node_modules')),
    },
    executables,
    environment: {
      valid: missingEnvironment.length === 0,
      missing: missingEnvironment,
    },
  }
}


export function runExecutionPreflight(snapshot, purpose = 'implementation') {
  const runtime = executionPreflightRuntime(snapshot)
  const repairBaselineFiles =
    verifiedRepairBaselineFiles(snapshot, runtime, purpose)

  return evaluateExecutionPreflight({
    packet: snapshot.packet,
    runtime,
    executions: snapshot.executions,
    serializationConflicts: snapshot.serialization_conflicts,
    purpose,
    repairBaselineFiles,
  })
}


export function preflightRecoveryPlan(snapshot, preflight) {
  const supervisorPlan = planSupervisorStep(snapshot)
  return {
    kind: preflight.kind === 'ready' ? 'act' : preflight.kind,
    next_action: preflight.ready ? supervisorPlan.next_action : preflight.next_action,
    failure_class: preflight.ready ? supervisorPlan.failure_class : preflight.failure_class,
    reason: preflight.reason,
    recoverable: preflight.recoverable,
    fingerprint: supervisorPlan.fingerprint,
    execution: supervisorPlan.execution,
    preflight_fingerprint: preflight.fingerprint,
  }
}


function taskExecutionPreflight() {
  const [taskId] = args
  if (!validTaskId(taskId)) {
    output({ ok: false, command: 'task-execution-preflight', error: 'valid_task_id_required' }, 64)
    return
  }

  try {
    const snapshot = supervisorSnapshot(taskId)
    if (!snapshot?.packet?.task) throw new Error(`Unknown task: ${taskId}`)
    const preflight = runExecutionPreflight(snapshot)
    const recoveryPlan = preflightRecoveryPlan(snapshot, preflight)
    recordSupervisorRecovery(snapshot, recoveryPlan, {
      idempotencyKey: `${randomUUID()}:preflight:${preflight.fingerprint}`,
      status: preflight.ready ? 'resolved' : preflight.kind === 'stop' ? 'resolved' : 'active',
      condition: { preflight: true, preflight_fingerprint: preflight.fingerprint, checks: preflight.checks },
      metadata: { preflight: true, context: preflight.context },
    })
    output({
      ok: preflight.ready,
      command: 'task-execution-preflight',
      task_id: taskId,
      preflight,
    }, preflight.ready ? 0 : 1)
  }
  catch (error) {
    output({ ok: false, command: 'task-execution-preflight', task_id: taskId, error: error.message }, 1)
  }
}


function recordSupervisorRecovery(snapshot, plan, options = {}) {
  const task = snapshot.packet.task
  const openFailure = [...(snapshot.failures ?? [])]
    .filter(failure => failure.resolved_at == null)
    .at(-1)
  const resumeIdentity = supervisorResumeIdentity(task.task_id)
  const heartbeat = options.heartbeat ?? new Date().toISOString()
  const nextWake = plan.kind === 'wait' && !['wait-operator','wait-decision','safety-stop'].includes(plan.next_action) || plan.kind === 'reconcile'
    ? new Date(Date.now() + recoveryBackoff(snapshot.runtime_operations?.at(-1)?.infra_retries ?? 0)).toISOString()
    : ''
  const condition = {
    fingerprint: plan.fingerprint,
    reason: plan.reason,
    route: plan.kind,
    command: plan.command ?? null,
    ...(options.condition ?? {}),
  }
  const watch = watchDescriptorForRecovery(snapshot, plan, options)
  if (watch && !condition.watch) condition.watch = watch
  const metadata = {
    supervisor: 'task-supervisor-v1',
    ...(options.metadata ?? {}),
  }
  const recordSql = `
      SELECT control.record_recovery_condition(
        :'resume_identity', :'idempotency_key', :'failure_class',
        NULLIF(:'error_code', ''), :'next_action', :'recoverable'::boolean,
        'supervisor', NULLIF(:'project_id', '')::uuid,
        NULLIF(:'workstream_slug', ''), NULL, :'task_id',
        NULLIF(:'execution_id', '')::bigint, NULLIF(:'failure_id', '')::bigint,
        NULLIF(:'next_wake_at', '')::timestamptz, :'heartbeat_at'::timestamptz,
        NULLIF(:'lease_owner', ''), NULLIF(:'lease_token', ''),
        NULLIF(:'lease_expires_at', '')::timestamptz,
        :'condition'::jsonb, :'metadata'::jsonb, :'status'
      );
    `
  const result = controlQuery(
    options.acquireLease
      ? initialSupervisorLeaseSql(recordSql.trim().replace(/^SELECT\s+/, '').replace(/;$/, ''))
      : recordSql,
    {
      resume_identity: resumeIdentity,
      idempotency_key: options.idempotencyKey ?? `decision:${plan.fingerprint}:${plan.next_action}`,
      failure_class: plan.failure_class,
      error_code: plan.reason ?? '',
      next_action: plan.next_action,
      recoverable: plan.recoverable === false ? 'false' : 'true',
      project_id: snapshot.packet.project?.project_id ?? '',
      workstream_slug: snapshot.packet.workstream?.slug ?? '',
      task_id: task.task_id,
      execution_id: String(plan.execution?.execution_id ?? ''),
      failure_id: String(options.failureId ?? openFailure?.failure_id ?? ''),
      next_wake_at: nextWake,
      heartbeat_at: heartbeat,
      lease_owner: options.leaseOwner ?? '',
      lease_token: options.leaseToken ?? '',
      lease_expires_at: options.leaseExpiresAt ?? '',
      condition: JSON.stringify(condition),
      metadata: JSON.stringify(metadata),
      status: options.status ?? 'active',
    },
  )

  return parseControlJson(result)
}


function claimDueExternalRecovery(owner, token) {
  const result = controlQuery(
    `
      SELECT control.claim_due_external_recovery(
        :'owner', :'token', :'lease_seconds'::integer
      );
    `,
    {
      owner,
      token,
      lease_seconds: String(WATCHER_LEASE_MS / 1000),
    },
  )
  return parseControlJson(result)
}


function probeControlDependency(descriptor) {
  if (descriptor.kind === 'control-execution') {
    return classifyControlProbe(descriptor, parseControlJson(controlQuery(
      `SELECT to_jsonb(e) FROM control.executions e WHERE e.execution_id = :'execution_id'::bigint;`,
      { execution_id: String(descriptor.execution_id) },
    )))
  }

  if (descriptor.kind === 'control-task-dependencies') {
    return classifyControlProbe(descriptor, parseControlJson(controlQuery(
      `
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'task_id', t.task_id, 'status', t.status
        ) ORDER BY t.task_id), '[]'::jsonb)
        FROM control.tasks t
        WHERE t.task_id IN (
          SELECT jsonb_array_elements_text(:'task_ids'::jsonb)
        );
      `,
      { task_ids: JSON.stringify(descriptor.task_ids) },
    )))
  }

  return classifyControlProbe(descriptor, parseControlJson(controlQuery(
    `
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'task_id', t.task_id, 'status', t.status, 'engine_stage', t.engine_stage
      ) ORDER BY t.task_id), '[]'::jsonb)
      FROM control.tasks t
      WHERE t.project_id = :'project_id'::uuid
        AND t.workstream_slug = :'workstream_slug'
        AND t.task_id <> :'task_id'
        AND t.status IN ('in_progress', 'verification', 'passed', 'failed');
    `,
    {
      project_id: descriptor.project_id,
      workstream_slug: descriptor.workstream_slug,
      task_id: descriptor.task_id,
    },
  )))
}


function probeExternalDependency(descriptor) {
  if (descriptor.kind.startsWith('control-')) return probeControlDependency(descriptor)
  const result = execute('gh', githubProbeCommand(descriptor), {
    timeout: 30 * 1000,
  })
  return githubProbeObservation(descriptor, result)
}


function recordExternalWatchResult(recovery, token, transition) {
  const result = controlQuery(
    `
      SELECT control.record_external_watch_result(
        :'resume_identity', :'lease_token', :'observation'::jsonb,
        :'actionable'::boolean, :'poll_count'::integer,
        :'next_wake_at'::timestamptz, 'external-watcher'
      );
    `,
    {
      resume_identity: recovery.resume_identity,
      lease_token: token,
      observation: JSON.stringify(transition.observation),
      actionable: transition.actionable ? 'true' : 'false',
      poll_count: String(transition.poll_count),
      next_wake_at: transition.next_wake_at,
    },
  )
  return parseControlJson(result)
}


function externalWatcher() {
  const requestedLimit = args[0] == null ? 10 : Number(args[0])
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > WATCHER_MAX_BATCH) {
    output({ ok: false, command: 'external-watch', error: 'watch_limit_must_be_between_1_and_25' }, 64)
    return
  }

  const owner = `${process.pid}@${process.env.HOSTNAME ?? 'local'}`
  const results = []
  try {
    for (let index = 0; index < requestedLimit; index++) {
      const token = randomUUID()
      const recovery = claimDueExternalRecovery(owner, token)
      if (!recovery) break

      const descriptor = normalizeWatchDescriptor(recovery)
      if (!descriptor) {
        throw new Error(`claimed_recovery_has_invalid_watch_descriptor:${recovery.resume_identity}`)
      }

      const observedAt = new Date()
      const observation = probeExternalDependency(descriptor)
      const transition = watchTransition(recovery, observation, observedAt)
      const recorded = recordExternalWatchResult(recovery, token, transition)
      let resume = null

      if (recorded?.applied && transition.actionable && validTaskId(recovery.current_task_id)) {
        const child = invokeTaskAction('task-supervise', recovery.current_task_id)
        resume = {
          invoked: true,
          ok: child.payload?.ok === true,
          status: child.payload?.status ?? null,
          reason: child.payload?.reason ?? child.payload?.error ?? null,
        }
      }

      results.push({
        resume_identity: recovery.resume_identity,
        task_id: recovery.current_task_id,
        dependency: descriptor,
        observation,
        changed: transition.changed,
        actionable: transition.actionable,
        next_wake_at: transition.next_wake_at,
        poll_count: transition.poll_count,
        persisted: recorded,
        resume,
      })

      // An actionable row stays due until the supervisor durably advances it.
      // End this bounded invocation so a failed/crashed resume cannot cause an
      // immediate reclaim loop in the same process.
      if (transition.actionable) break
    }

    output({
      ok: true,
      command: 'external-watch',
      checked: results.length,
      limit: requestedLimit,
      results,
    })
  }
  catch (error) {
    output({
      ok: false,
      command: 'external-watch',
      error: error.message,
      checked: results.length,
      results,
    }, 1)
  }
}


function acquireSupervisorLease(snapshot, plan, owner, token, expiresAt) {
  return recordSupervisorRecovery(snapshot, plan, {
    idempotencyKey: `${token}:initial`,
    leaseOwner: owner, leaseToken: token, leaseExpiresAt: expiresAt,
    acquireLease: true,
  })
}


function activeSupervisorLease(recovery) {
  return Boolean(
    recovery?.status === 'active' &&
    recovery.heartbeat_at &&
    recovery.lease_token &&
    recovery.lease_expires_at &&
    Date.parse(recovery.heartbeat_at) <= Date.now() &&
    Date.parse(recovery.heartbeat_at) < Date.parse(recovery.lease_expires_at) &&
    Date.parse(recovery.lease_expires_at) > Date.now(),
  )
}


function localSupervisorLeasePid(recovery) {
  const match = String(recovery?.lease_owner ?? '').match(/^([1-9][0-9]*)@(.+)$/)
  if (!match) return null

  const localHosts = new Set(
    ['local', process.env.HOSTNAME]
      .filter(Boolean),
  )

  if (!localHosts.has(match[2])) return null
  return Number(match[1])
}


function localProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    return error?.code === 'EPERM'
  }
}


function reclaimDeadLocalSupervisorLease(recovery) {
  if (!activeSupervisorLease(recovery)) return false

  const pid = localSupervisorLeasePid(recovery)
  if (!pid || localProcessAlive(pid)) return false

  const result = controlQuery(
    `
      WITH reclaimed AS (
        UPDATE control.recovery_states
        SET lease_owner = NULL,
            lease_token = NULL,
            lease_expires_at = NULL,
            updated_at = now(),
            metadata = COALESCE(metadata, '{}'::jsonb) ||
              jsonb_build_object(
                'dead_local_lease_reclaimed_at', now(),
                'dead_local_lease_owner', :'lease_owner'
              )
        WHERE resume_identity = :'resume_identity'
          AND status = 'active'
          AND lease_owner = :'lease_owner'
          AND lease_token = :'lease_token'
          AND lease_expires_at > now()
        RETURNING recovery_state_id
      )
      SELECT jsonb_build_object(
        'reclaimed',
        EXISTS(SELECT 1 FROM reclaimed)
      );
    `,
    {
      resume_identity: recovery.resume_identity,
      lease_owner: recovery.lease_owner,
      lease_token: recovery.lease_token,
    },
  )

  return parseControlJson(result)?.reclaimed === true
}


function prepareTaskDependencies(worktreePath) {
  if (!worktreePath || !existsSync(worktreePath)) {
    return {
      ok: false,
      command: 'prepare-dependencies',
      error: 'dependency_worktree_not_found',
      exit_code: 1,
    }
  }

  const result = execute(
    'pnpm',
    [
      'install',
      '--frozen-lockfile',
      '--prefer-offline',
    ],
    {
      cwd: worktreePath,
      timeout: 20 * 60 * 1000,
    },
  )

  return {
    ok: successful(result),
    command: 'prepare-dependencies',
    exit_code: result.code,
    error:
      successful(result)
        ? null
        : result.stderr || result.error || result.stdout || 'dependency_prepare_failed',
  }
}


function taskSupervisor() {
  const [taskId] = args
  if (!validTaskId(taskId)) {
    output({ ok: false, command: 'task-supervise', error: 'valid_task_id_required' }, 64)
    return
  }

  const owner = `${process.pid}@${process.env.HOSTNAME ?? 'local'}`
  const token = randomUUID()
  const leaseExpiresAt = new Date(Date.now() + 80 * 60 * 1000).toISOString()
  const trail = []

  try {
    const currentRun=parseControlJson(controlQuery(`SELECT to_jsonb(r) FROM control.workflow_runs r WHERE current_task_id=:'task' AND status='running' ORDER BY started_at DESC LIMIT 1;`,{task:taskId}))
    if(currentRun?.run_id && !currentRun.admitted_repair_id) controlQuery(`SELECT control.reconcile_ordinary_run_publication(:'run'::uuid);`,{run:currentRun.run_id})
    const bindingSnapshot=supervisorSnapshot(taskId)
    if(bindingSnapshot?.binding_recovery) {
      controlQuery(`SELECT control.reconcile_strict_verification_binding(:'task',:'proof'::jsonb);`,{task:taskId,proof:JSON.stringify(bindingSnapshot.binding_recovery)})
      if(bindingSnapshot.workflow_run?.run_id && bindingSnapshot.run_publication_authority?.authorized) controlQuery(`SELECT control.refresh_dot_admission(:'run'::uuid);`,{run:bindingSnapshot.workflow_run.run_id})
    }
    controlQuery(`SELECT control.audit_product_attempts(:'task');`,{task:taskId})
    let snapshot = supervisorSnapshot(taskId)
    if (!snapshot?.packet?.task) throw new Error(`Unknown task: ${taskId}`)

    if (reclaimDeadLocalSupervisorLease(snapshot.recovery)) {
      trail.push({
        step: 0,
        command: 'reclaim-dead-local-supervisor-lease',
        exit_code: 0,
        ok: true,
        response: {
          reclaimed: true,
          lease_owner: snapshot.recovery?.lease_owner ?? null,
        },
      })
      snapshot = supervisorSnapshot(taskId)
    }

    if (activeSupervisorLease(snapshot.recovery)) {
      output({
        ok: true,
        command: 'task-supervise',
        task_id: taskId,
        status: 'wait',
        reason: 'supervisor_lease_active',
        resume_identity: snapshot.recovery.resume_identity,
        lease_owner: snapshot.recovery.lease_owner,
        lease_expires_at: snapshot.recovery.lease_expires_at,
        trail,
      })
      return
    }

    snapshot = evaluateSupervisorParentSatisfaction(snapshot)
    let plan = planSupervisorStep(snapshot)

    if (plan.kind !== 'act') {
      const successfulTerminal = ['task_complete', 'task_cancelled'].includes(plan.reason)
      const persistedRecovery = recordSupervisorRecovery(snapshot, plan, {
        idempotencyKey: `${token}:settled`,
        status: plan.kind === 'terminal' ? 'resolved' : 'active',
      })
      output({
        ok: plan.kind !== 'terminal' || successfulTerminal,
        command: 'task-supervise', task_id: taskId,
        status: plan.kind, recovery: { ...plan, ...persistedRecovery }, trail,
      }, plan.kind === 'terminal' && !successfulTerminal ? 1 : 0)
      return
    }

    const lease = acquireSupervisorLease(
      snapshot, plan, owner, token, leaseExpiresAt,
    )
    if (!lease?.acquired) {
      output({ ok: true, command: 'task-supervise', task_id: taskId, status: 'wait', reason: 'supervisor_lease_contended', lease_expires_at: lease?.recovery?.lease_expires_at ?? null, trail })
      return
    }

    for (let step = 1; step <= 16; step++) {
      snapshot = evaluateSupervisorParentSatisfaction(supervisorSnapshot(taskId))
      plan = planSupervisorStep(snapshot)

      recordSupervisorRecovery(snapshot, plan, {
        idempotencyKey: `${token}:step:${step}`,
        leaseOwner: owner,
        leaseToken: token,
        leaseExpiresAt,
        condition: { step },
      })

      if (plan.kind !== 'act') {
        const successfulTerminal = ['task_complete', 'task_cancelled'].includes(plan.reason)
        const persistedRecovery = recordSupervisorRecovery(snapshot, plan, {
          idempotencyKey: `${token}:release:${step}`,
          status: plan.kind === 'terminal' ? 'resolved' : 'active',
          condition: { step },
        })
        output({
          ok: plan.kind !== 'terminal' || successfulTerminal,
          command: 'task-supervise', task_id: taskId,
          status: plan.kind, recovery: { ...plan, ...persistedRecovery }, trail,
        }, plan.kind === 'terminal' && !successfulTerminal ? 1 : 0)
        return
      }

      if (['task-run', 'task-retry'].includes(plan.command) && !plan.operation) {
        const preflight = runExecutionPreflight(
          snapshot,
          plan.command === 'task-retry'
            ? retryPurpose(snapshot)
            : 'implementation',
        )
        const recoveryPlan = preflightRecoveryPlan(snapshot, preflight)
        trail.push({
          step,
          command: 'task-execution-preflight',
          exit_code: preflight.ready ? 0 : 1,
          ok: preflight.ready,
          response: preflight,
        })
        const reconciliationAction = preflightReconciliationAction(preflight)
        const keepLeaseForReconciliation = Boolean(reconciliationAction)

        const persistedRecovery = recordSupervisorRecovery(snapshot, recoveryPlan, {
          idempotencyKey: `${token}:preflight:${step}:${preflight.fingerprint}`,
          status: preflight.ready ? 'active' : preflight.kind === 'stop' ? 'resolved' : 'active',
          leaseOwner: preflight.ready || keepLeaseForReconciliation ? owner : '',
          leaseToken: preflight.ready || keepLeaseForReconciliation ? token : '',
          leaseExpiresAt: preflight.ready || keepLeaseForReconciliation ? leaseExpiresAt : '',
          condition: { preflight: true, step, preflight_fingerprint: preflight.fingerprint, checks: preflight.checks },
          metadata: { preflight: true, context: preflight.context },
        })

        if (!preflight.ready && reconciliationAction) {
          let reconciliation

          if (reconciliationAction === 'task-prepare') {
            const child = invokeTaskAction('task-prepare', taskId)
            reconciliation = {
              ok: child.payload?.ok === true,
              command: reconciliationAction,
              exit_code: child.result.code,
              response: child.payload,
              error:
                child.payload?.error ??
                child.result.stderr ??
                child.result.error ??
                null,
            }
          }
          else {
            const prepared = prepareTaskDependencies(
              preflight.context?.worktree_path ??
                snapshot.packet?.preparation?.worktree?.worktree_path,
            )
            reconciliation = {
              ...prepared,
              response: prepared,
            }
          }

          trail.push({
            step,
            command: reconciliation.command,
            exit_code: reconciliation.exit_code,
            ok: reconciliation.ok,
            response: reconciliation.response,
          })

          if (reconciliation.ok) {
            continue
          }

          controlQuery(`SELECT control.audit_product_attempts(:'task');`,{task:taskId})
          const failedSnapshot = supervisorSnapshot(taskId)
          const classified = classifySupervisorFailure({
            command: reconciliation.command,
            payload: {
              error:
                reconciliation.error ??
                `${reconciliation.command}_failed`,
            },
            attempt: failedSnapshot.retry_accounting?.consumed ?? plan.execution?.attempt,
            maxAttempts: snapshot.packet.retry_policy?.max_attempts,
          })

          classified.fingerprint =
            planSupervisorStep(failedSnapshot).fingerprint
          classified.execution =
            planSupervisorStep(failedSnapshot).execution

          const persistedFailure = recordSupervisorRecovery(
            failedSnapshot,
            classified,
            {
              idempotencyKey: `${token}:reconciliation:${step}`,
              status:
                classified.kind === 'terminal'
                  ? 'resolved'
                  : 'active',
              metadata: {
                reconciliation_command: reconciliation.command,
                reconciliation_exit_code: reconciliation.exit_code,
              },
            },
          )

          output({
            ok: classified.kind === 'wait',
            command: 'task-supervise',
            task_id: taskId,
            status: classified.kind,
            recovery: {
              ...classified,
              ...persistedFailure,
            },
            preflight,
            trail,
          }, classified.kind === 'wait' ? 0 : 1)
          return
        }

        if (!preflight.ready) {
          output({
            ok: preflight.kind !== 'stop',
            command: 'task-supervise',
            task_id: taskId,
            status: preflight.kind,
            recovery: { ...recoveryPlan, ...persistedRecovery },
            preflight,
            trail,
          }, preflight.kind === 'stop' ? 1 : 0)
          return
        }
      }

      let child
      if (plan.command === 'complete-parent-satisfied') {
        recordSupervisorRecovery(snapshot, plan, {
          idempotencyKey: `parent-satisfaction:${plan.parent_satisfaction.fingerprint}`,
          leaseOwner: owner,
          leaseToken: token,
          leaseExpiresAt,
          condition: {
            parent_satisfaction: plan.parent_satisfaction,
            step,
          },
          metadata: { parent_satisfaction: true },
        })
        const response = completeParentSatisfied(taskId, plan.parent_satisfaction)
        child = { result: { code: 0, stderr: '' }, payload: { ok: true, completion: response } }
      }
      else if (plan.command === 'handle-no-publishable-changes') {
        const response = handleNoPublishableChanges(taskId)
        child = { result: { code: 0, stderr: '' }, payload: { ok: response?.action !== 'blocked', resolution: response } }
      }
      else {
        child = invokeTaskAction(plan.command, taskId)
      }

      trail.push({
        step,
        command: plan.command,
        exit_code: child.result.code,
        ok: child.payload?.ok === true,
        response: child.payload,
      })

      if (child.payload?.ok !== true) {
        controlQuery(`SELECT control.audit_product_attempts(:'task');`,{task:taskId})
        const failedSnapshot = supervisorSnapshot(taskId)
        const classified = classifySupervisorFailure({
          command: plan.command,
          payload: child.payload,
          attempt: failedSnapshot.retry_accounting?.consumed ?? currentExecution(failedSnapshot)?.attempt,
          maxAttempts: failedSnapshot.packet.retry_policy?.max_attempts,
        })
        classified.fingerprint = planSupervisorStep(failedSnapshot).fingerprint
        classified.execution = planSupervisorStep(failedSnapshot).execution

        if (classified.command === 'handle-no-publishable-changes') {
          const resolution = handleNoPublishableChanges(taskId)
          trail.push({ step, command: classified.command, exit_code: 0, ok: resolution?.action !== 'blocked', response: resolution })
          if (resolution?.action === 'complete_no_changes') continue
        }

        const failure = [...(failedSnapshot.failures ?? [])].at(-1)
        const persistedRecovery = recordSupervisorRecovery(failedSnapshot, classified, {
          idempotencyKey: `${token}:failure:${step}`,
          failureId: failure?.failure_id,
          status: classified.kind === 'terminal' ? 'resolved' : 'active',
          leaseOwner: classified.kind === 'act' ? owner : '',
          leaseToken: classified.kind === 'act' ? token : '',
          leaseExpiresAt: classified.kind === 'act' ? leaseExpiresAt : '',
          metadata: { child_command: plan.command, child_exit_code: child.result.code },
        })

        if (classified.kind === 'act') continue

        output({
          ok: classified.kind === 'wait', command: 'task-supervise', task_id: taskId,
          status: classified.kind, recovery: { ...classified, ...persistedRecovery }, trail,
        }, classified.kind === 'wait' ? 0 : 1)
        return
      }
    }

    const exhaustedSnapshot = supervisorSnapshot(taskId)
    const exhaustedPlan = {
      ...planSupervisorStep(exhaustedSnapshot),
      kind: 'wait', next_action: 'wait-external', failure_class: 'transient-infrastructure',
      reason: 'supervisor_time_slice_yield', recoverable: true,
    }
    recordSupervisorRecovery(exhaustedSnapshot, exhaustedPlan, {
      idempotencyKey: `${token}:step-limit`, status: 'active',
    })
    output({ ok: true, command: 'task-supervise', task_id: taskId, status: 'wait', recovery: exhaustedPlan, trail })
  }
  catch (error) {
    if (isControlDatabaseConnectivityError(error)) {
      output({
        ...controlDatabaseWaitOutcome({
          taskId,
          command: 'task-supervise',
          error,
        }),
        trail,
      })
      return
    }

    {
      try {
        controlQuery(`SELECT control.audit_product_attempts(:'task');`,{task:taskId})
        const failedSnapshot = supervisorSnapshot(taskId)
        const currentPlan = planSupervisorStep(failedSnapshot)
        const classified = classifySupervisorFailure({
          command: 'task-supervise',
          payload: { error: error.message },
          attempt: failedSnapshot.retry_accounting?.consumed ?? currentPlan.execution?.attempt,
          maxAttempts: failedSnapshot.packet.retry_policy?.max_attempts,
        })
        classified.fingerprint = currentPlan.fingerprint
        classified.execution = currentPlan.execution
        recordSupervisorRecovery(failedSnapshot, classified, {
          idempotencyKey: `${token}:exception`,
          status: classified.kind === 'terminal' ? 'resolved' : 'active',
          metadata: { supervisor_error: true },
        })
      }
      catch {
        // The original supervisor error remains authoritative. An unreachable
        // control database leaves the lease to expire rather than guessing.
      }
    }
    output({ ok: false, command: 'task-supervise', task_id: taskId, error: error.message, trail }, 1)
  }
}


function taskEngine() {
  const [taskId] = args

  if (!validTaskId(taskId)) {
    output({
      ok: false,
      command:
        'task-engine',
      error:
        'valid_task_id_required',
    }, 64)

    return
  }

  const trail = []
  let publishAttempts = 0

  try {

    for (
      let step = 1;
      step <= 16;
      step++
    ) {

      const packet =
        engineTaskPacket(
          taskId,
        )

      if (!packet) {
        throw new Error(
          `Unknown task: ${taskId}`,
        )
      }

      const status =
        packet.task.status

      const execution =
        latestExecution(
          taskId,
        )


      if (status === 'complete') {
        output({
          ok: true,

          command:
            'task-engine',

          task_id:
            taskId,

          status:
            'complete',

          execution_id:
            execution?.execution_id ??
            null,

          attempt:
            execution?.attempt ??
            null,

          trail,
        })

        return
      }


      let action = null


      if (status === 'in_progress') {

        if (!execution) {
          action =
            'task-run'
        }
        else if (
          execution.status ===
          'succeeded'
        ) {
          action =
            'task-verify'
        }
        else if (
          execution.status ===
          'running'
        ) {
          output({
            ok: false,

            command:
              'task-engine',

            task_id:
              taskId,

            error:
              'execution_still_running',

            execution_id:
              execution.execution_id,

            attempt:
              execution.attempt,

            trail,
          }, 1)

          return
        }
        else {
          output({
            ok: false,

            command:
              'task-engine',

            task_id:
              taskId,

            error:
              'inconsistent_in_progress_execution',

            task_status:
              status,

            execution_status:
              execution.status,

            execution_id:
              execution.execution_id,

            trail,
          }, 1)

          return
        }

      }
      else if (
        status === 'verification'
      ) {

        action =
          'task-verify'

      }
      else if (
        status === 'failed'
      ) {

        if (!execution) {
          throw new Error(
            'Failed task has no execution.',
          )
        }

        const retryPolicy =
          validateRetryPolicy(
            packet.retry_policy,
          )

        const decision =
          retryDecision(
            retryPolicy,
            supervisorSnapshot(taskId).retry_accounting?.consumed ?? execution.attempt,
          )

        const verificationFailure =
          execution.status === 'succeeded'

        const failedChecks =
          verificationFailure
            ? verificationFailures(
                execution.execution_id,
              )
            : []

        const failureStage =
          verificationFailure
            ? 'verification'
            : 'implementation'

        const executionError =
          verificationFailure
            ? null
            : redactText(
                execution.metadata?.stderr ??
                execution.metadata?.error ??
                'implementation_failed',
              ).slice(0, 4000)

        const legalActions = [
          'inspect',
          'error-bundle',
        ]

        if (verificationFailure) {
          legalActions.push(
            'reverify',
          )
        }

        if (decision.allowed) {
          legalActions.push(
            'retry',
          )
        }

        if (!decision.allowed) {
          output({
            ok: false,

            command:
              'task-engine',

            task_id:
              taskId,

            error:
              'retry_limit_reached',

            failure_stage:
              failureStage,

            execution_status:
              execution.status,

            execution_error:
              executionError,

            attempt:
              execution.attempt,

            max_attempts:
              retryPolicy.max_attempts,

            retry_policy:
              retryPolicy,

            verification_failures:
              failedChecks,

            legal_actions:
              legalActions,

            trail,
          }, 1)

          return
        }


        action =
          'task-retry'
      }
      else if (
        status === 'passed'
      ) {

        if (
          publishAttempts >= 2
        ) {
          output({
            ok: false,

            command:
              'task-engine',

            task_id:
              taskId,

            error:
              'publication_retry_exhausted',

            trail,
          }, 1)

          return
        }

        publishAttempts++

        action =
          'task-publish'

      }
      else {

        output({
          ok: false,

          command:
            'task-engine',

          task_id:
            taskId,

          error:
            'task_not_resumable',

          task_status:
            status,

          trail,
        }, 1)

        return
      }


      const before =
        [
          status,
          execution?.execution_id ??
            'none',
          execution?.status ??
            'none',
          execution?.attempt ??
            0,
        ].join(':')


      const child =
        invokeTaskAction(
          action,
          taskId,
        )


      trail.push({
        step,
        action,

        exit_code:
          child.result.code,

        ok:
          child.payload?.ok ===
          true,

        response:
          child.payload,
      })


      const afterPacket =
        engineTaskPacket(
          taskId,
        )

      const afterExecution =
        latestExecution(
          taskId,
        )

      const after =
        [
          afterPacket?.task?.status ??
            'unknown',
          afterExecution?.execution_id ??
            'none',
          afterExecution?.status ??
            'none',
          afterExecution?.attempt ??
            0,
        ].join(':')


      if (
        child.payload === null
      ) {
        output({
          ok: false,

          command:
            'task-engine',

          task_id:
            taskId,

          error:
            'invalid_child_response',

          action,

          stderr:
            child.result.stderr,

          trail,
        }, 1)

        return
      }

      if (
        action === 'task-publish' &&
        child.payload.ok !== true
      ) {

        const publicationError =
          child.payload.publication?.error ??
          child.payload.error ??
          'publication_failed'


        if (
          publicationError ===
          'no_publishable_changes'
        ) {

          const resolution =
            handleNoPublishableChanges(
              taskId,
            )


          trail.push({
            step,
            action:
              'handle-no-publishable-changes',

            exit_code:
              0,

            ok:
              resolution?.action !==
              'blocked',

            response:
              resolution,
          })


          if (
            resolution?.action ===
            'complete_no_changes'
          ) {

            output({
              ok: true,

              command:
                'task-engine',

              task_id:
                taskId,

              status:
                'complete',

              completion:
                'no_changes',

              resolution,

              trail,
            })

            return

          }


          if (
            resolution?.action ===
            'retry'
          ) {
            continue
          }


          output({
            ok: false,

            command:
              'task-engine',

            task_id:
              taskId,

            error:
              'repeated_no_publishable_changes',

            stage:
              'task-publish',

            human_intervention_required:
              true,

            resolution,

            trail,
          }, 1)

          return

        }


        const recoverySnapshot =
          supervisorSnapshot(taskId)

        const recovery =
          classifySupervisorFailure({
            command: 'task-publish',
            payload: child.payload,
            attempt: execution?.attempt,
            maxAttempts: packet.retry_policy?.max_attempts,
          })

        recovery.fingerprint =
          planSupervisorStep(recoverySnapshot).fingerprint

        recovery.execution =
          execution

        if (recovery.kind === 'wait') {
          const failure = [...(recoverySnapshot.failures ?? [])].at(-1)
          recordSupervisorRecovery(recoverySnapshot, recovery, {
            idempotencyKey: `task-engine:publication:${recovery.fingerprint}:${recovery.reason}`,
            failureId: failure?.failure_id,
            status: 'active',
            metadata: { legacy_task_engine: true },
          })

          output({
            ok: true,
            command: 'task-engine',
            task_id: taskId,
            status: 'wait',
            recovery,
            trail,
          })

          return
        }


        const retryablePublicationError =
          publicationError ===
          'pr_create_failed'


        if (
          !retryablePublicationError ||
          publishAttempts >= 2
        ) {

          output({
            ok: false,

            command:
              'task-engine',

            task_id:
              taskId,

            error:
              publicationError,

            stage:
              'task-publish',

            details:
              child.payload,

            trail,
          }, 1)

          return
        }

      }

      if (
        child.payload.ok !== true &&
        before === after &&
        action !== 'task-publish'
      ) {
        output({
          ok: false,

          command:
            'task-engine',

          task_id:
            taskId,

          error:
            child.payload.error ??
            child.payload.publication?.error ??
            'task_action_failed_without_state_transition',

          stage:
            action,

          details:
            child.payload,

          trail,
        }, 1)

        return
      }

    }


    output({
      ok: false,

      command:
        'task-engine',

      task_id:
        taskId,

      error:
        'engine_step_limit_reached',

      trail,
    }, 1)

  }
  catch (error) {

    output({
      ok: false,

      command:
        'task-engine',

      task_id:
        taskId,

      error:
        error.message,

      trail,
    }, 1)

  }
}


function attachRuntimeExecution(executionId) {
  if (!process.env.BS_OPERATION_ID) return
  controlQuery(`UPDATE control.runtime_operations SET execution_id=:'execution_id'::bigint, status='running',updated_at=now() WHERE operation_id=:'id'::uuid;`, { id: process.env.BS_OPERATION_ID, execution_id: String(executionId) })
}

function recoveryWatch() {
  try {
    const candidates = parseControlJson(controlQuery(`SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM control.workflow_runs r WHERE status='running' OR (status='failed' AND workstream_slug='shared' AND current_task_id IS NOT NULL AND control.resolved_retry_policy(current_task_id)->>'policy_id'='shared-foundation-five');`))
    const outcomes = []
    for (const candidate of candidates) {
      if (candidate.current_task_id && candidate.workstream_slug === 'shared') {
        controlQuery(`SELECT control.audit_product_attempts(:'task');`, { task:candidate.current_task_id })
        const audit=parseControlJson(controlQuery(`SELECT control.reconcile_shared_retry_exhaustion(:'id'::uuid);`, { id:candidate.run_id }))
        if(audit.accounting) outcomes.push({run_id:candidate.run_id,task_id:candidate.current_task_id,action:'shared_retry_exhaustion_audit',...audit})
      }
      const row = parseControlJson(controlQuery(`SELECT to_jsonb(r) FROM control.workflow_runs r WHERE run_id=:'id'::uuid;`, { id: candidate.run_id }))
      if(row.admitted_repair_id && !row.stop_requested && !row.maintenance_requested) {
        const refresh=execute(process.execPath,[agentScriptPath,'run-refresh-admission',row.run_id],{cwd:repoRoot,timeout:30000})
        if(refresh.code!==0){outcomes.push({run_id:row.run_id,eligible:false,reason:'admission_scope_gate',details:parseJson(refresh.stdout,null)});continue}
      }
      if(!row.admitted_repair_id && !row.stop_requested && !row.maintenance_requested) {
        try { controlQuery(`SELECT control.reconcile_ordinary_run_publication(:'run'::uuid);`,{run:row.run_id}) } catch(error) {outcomes.push({run_id:row.run_id,eligible:false,reason:'ordinary_publication_scope_gate',error:error.message});continue}
      }
      const snapshot = row.current_task_id ? supervisorSnapshot(row.current_task_id) : null
      const plan = snapshot ? planSupervisorStep(snapshot) : null
      if (plan && !['execution_in_flight','runtime_operation_resume','verification_required','implementation_required','publication_pending'].includes(plan.reason)) {
        const incident=incidentIdentity(snapshot,plan)
        controlQuery(`SELECT control.record_dot_incident(:'run'::uuid,:'task',NULLIF(:'execution','')::bigint,:'fingerprint',:'classification',:'evidence'::jsonb);`,{run:row.run_id,task:incident.task_id,execution:String(incident.execution_id??''),fingerprint:incident.root_fingerprint,classification:incident.classification,evidence:JSON.stringify({plan,recovery:snapshot.recovery,operations:snapshot.runtime_operations})})
      }
      if(snapshot) snapshot.watchdog_plan=plan
      const eligible = runWakeEligibility(row, snapshot?.recovery, snapshot?.runtime_operations?.at(-1), Date.now(), snapshot)
      if (!eligible.eligible) { outcomes.push({ run_id: row.run_id, ...eligible }); continue }
      const lockDir = path.join(repoRoot,'.local','runtime-run-locks')
      mkdirSync(lockDir,{ recursive:true,mode:0o700 })
      const lock = path.join(lockDir,`${row.run_id}.lock`)
      if (receiptLocked({lock})) { outcomes.push({ run_id: row.run_id, eligible:false,reason:'controller_process_active' }); continue }
      const child = spawn('flock',['-n',lock,process.execPath,agentScriptPath,'run-recover',row.run_id],{ cwd:repoRoot,env:process.env,detached:true,stdio:'ignore' })
      child.unref()
      outcomes.push({ run_id:row.run_id,task_id:row.current_task_id,action:'existing_run_wake',pid:child.pid })
    }
    const lastCleanup=parseControlJson(controlQuery(`SELECT jsonb_build_object('due',NOT EXISTS(SELECT 1 FROM control.dot_cycles WHERE started_at>now()-interval '15 minutes' AND outcomes @> '[{"action":"safe_cleanup_scan"}]'::jsonb));`))
    if(lastCleanup.due){
      const state=parseControlJson(controlQuery(`SELECT jsonb_build_object('tasks',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM control.tasks t),'runs',(SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM control.workflow_runs r),'publications',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]') FROM control.pull_requests p));`))
      const cleanup=cleanupIntegratedWorktrees({repository:{root:repoRoot,github_repository:githubRepository,integration_branch:'stg'},...state})
      outcomes.push({action:'safe_cleanup_scan',...cleanup})
    }
    controlQuery(`INSERT INTO control.dot_cycles(outcomes) VALUES(:'outcomes'::jsonb); UPDATE control.dot_wake_events SET consumed_at=now() WHERE consumed_at IS NULL;`,{outcomes:JSON.stringify(outcomes)})
    output({ok:true,command:'recovery-watch',outcomes,codex_invoked_by_scan:false})
  } catch(error) {
    output({ok:false,command:'recovery-watch',reason:'control_database_unavailable',retry_after_ms:30_000,error:error.message},1)
  }
}
function recoverWorkflowRun() {
  const [runId] = args
  if (!validRunId(runId)) { output({ok:false,error:'valid_run_id_required'},64); return }
  try {
    // Same SQL authority as BS20. Stable watchdog owner token is not an n8n
    // owner token and cannot bypass a currently held controller lease.
    for(let step=0;step<25;step++) {
      const gate = parseControlJson(controlQuery(`SELECT control.workflow_run_gate(:'id'::uuid);`,{id:runId}))
      if (!gate.should_continue) { output({ok:true,status:gate.reason,run:gate}); return }
      const acquisition = parseControlJson(controlQuery(`SELECT control.acquire_workflow_run_task(:'id'::uuid,'cp-batch-v2',:'fingerprint',:'token','runner');`,{id:runId,fingerprint:process.env.BS_BATCH_CONTROLLER_FINGERPRINT ?? 'c51e2846c1fe3966ac5705a2ba6e21c11804e4f1e0ea3be37a14ef2c47cca075',token:`selfheal:${runId}`}))
      if (!acquisition.acquired && acquisition.action !== 'credit_completion') { output({ok:true,status:'wait',run_id:runId,acquisition}); return }
      const taskId = acquisition.packet?.task?.task_id ?? acquisition.task_id
      if (!taskId) throw new Error('acquisition_task_identity_missing')
      let response = { status:'terminal',ok:true,recovery:{reason:'task_complete'} }
      if (acquisition.action !== 'credit_completion') {
        const result = execute(process.execPath,[agentScriptPath,'task-supervise',taskId],{cwd:repoRoot,timeout:75*60_000})
        response = parseJson(result.stdout,null)
        if (!response) throw new Error('malformed_supervisor_response')
      }
      if (response.ok && response.status === 'terminal' && response.recovery?.reason === 'task_complete') {
        controlQuery(`SELECT control.record_workflow_task_success(:'id'::uuid,:'task_id',:'key');`,{id:runId,task_id:taskId,key:`${runId}:${taskId}`})
        continue
      }
      if (response.status === 'terminal' && response.recovery?.reason === 'retry_budget_exhausted') {
        controlQuery(`SELECT control.finish_workflow_run(:'id'::uuid,'failed');`,{id:runId})
      }
      output({ok:true,command:'run-recover',run_id:runId,task_id:taskId,status:response.status,response});return
    }
    output({ok:true,command:'run-recover',run_id:runId,status:'time-slice-yield'})
  } catch(error) { output({ok:false,command:'run-recover',run_id:runId,error:error.message,classification:{failure_class:'transient-infrastructure',recovery_action:'wait-external'}},1) }
}
function taskReaccept() {
 const [taskId]=args
 if(!validTaskId(taskId)){output({ok:false,error:'valid_task_id_required'},64);return}
 try {
  const snapshot=supervisorSnapshot(taskId),execution=currentExecution(snapshot)
  const classification=effectiveFailureClass(snapshot,executionFailureClass(snapshot))
  if(execution?.status!=='failed' || !['verification-configuration','verification-infrastructure'].includes(classification) || snapshot.run_publication_authority?.authorized!==true) throw new Error('bounded_same_attempt_reacceptance_not_authorized')
  const directory=path.join(repoRoot,'.local','dot-reacceptance',taskId,String(execution.execution_id),process.env.BS_OPERATION_INFRA_GENERATION ?? '0')
  mkdirSync(directory,{recursive:true,mode:0o700})
  const packetPath=path.join(directory,'packet.json')
  // Guarded reacceptance runs a strict superset of the original mandatory plan.
  const commands=mergeVerificationConfig(snapshot.packet.project?.verification_config,snapshot.packet.workstream?.verification_config).commands
  const probePacket={...snapshot.packet,task:{...snapshot.packet.task,verification_plan:[...(snapshot.packet.task.verification_plan??[]),...commands.filter(c=>c.required!==false).map(c=>c.name)]}}
  writeFileSync(packetPath,JSON.stringify(probePacket),{mode:0o600})
  const result=execute(process.execPath,[path.join(controlSourceRoot,'tooling/control-plane/runner/task-verifier.mjs'),execution.worktree_path,packetPath,directory,'probe'],{cwd:repoRoot,timeout:70*60_000})
  const probe=parseJson(result.stdout,null)
  if(!probe?.passed){
    if(probe?.ok && probe.checks?.length) recordControlFailure(taskId,'verification','same_attempt_verification_failed',{classification:probe.classification,verification_probe:probe})
    output({ok:false,error:'same_attempt_verification_failed',classification:probe?.classification ?? {failure_class:'verification-infrastructure',recovery_action:'wait-external'},probe},1);return}
  const original=execution.metadata?.verification_probe_verified_state
  const currentState={base_sha:original?.base_sha,files:probe.verified_state?.files?.map(f=>({...f,object:existsSync(path.join(execution.worktree_path,f.file))?gitCheck(execution.worktree_path,['hash-object','--',f.file]).value:'deleted'}))}
  currentState.fingerprint=publicationStateFingerprint(currentState)
  const review=snapshot.retry_accounting?.classifications?.find(c=>Number(c.execution_id)===Number(execution.execution_id) && c.source==='human' && ['VERIFIER_INFRA','CONFIGURATION'].includes(c.classification))
  const verifierPaths=review?.evidence?.verifier_paths ?? (original?.files??[]).map(f=>f.file).filter(f=>f.includes('/tests/') && !f.includes('/migrations/'))
  const requiredChecks=probe.checks.filter(c=>c.required!==false && c.status!=='skipped').map(c=>c.name)
  if(!review && publicationStateFingerprint(currentState)!==publicationStateFingerprint(original)) throw new Error('automatic_reacceptance_source_changed')
  validateVerifierOnlyReacceptance({execution,probe,currentState,verifierPaths,requiredChecks})
  // This is a derived bounded authority, not a fabricated human approval.
  const approval=parseControlJson(controlQuery(`INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(:'task','verifier_reacceptance_authorized','dot',:'payload'::jsonb) RETURNING jsonb_build_object('event_id',event_id);`,{task:taskId,payload:JSON.stringify({run_id:snapshot.workflow_run.run_id,execution_id:execution.execution_id,attempt:execution.attempt,verifier_paths:verifierPaths,required_checks:requiredChecks,classification,source_unchanged:true})}))
  const accepted=parseControlJson(controlQuery(`SELECT control.reaccept_dot_verifier_only(:'task',:'execution'::bigint,:'approval'::bigint,:'probe'::jsonb);`,{task:taskId,execution:String(execution.execution_id),approval:String(approval.event_id),probe:JSON.stringify(probe)}))
  output({ok:true,command:'task-reaccept',task_id:taskId,...accepted})
 }catch(error){output({ok:false,error:error.message,classification:{failure_class:'operator-wait',recovery_action:'wait-operator'}},1)}
}
function executionFailureClass(snapshot){return snapshot.failures?.filter(f=>!f.resolved_at && f.execution_id===currentExecution(snapshot)?.execution_id).at(-1)?.failure_class}

function observableTaskStatus() {
  const [taskId] = args
  if(!validTaskId(taskId)) {output({ok:false,error:'valid_task_id_required'},64);return}
  try { const snapshot=supervisorSnapshot(taskId); const profile=snapshot.packet.task.model_profile ?? snapshot.packet.project.default_model_profile ?? 'standard'; output({ok:true,command:'task-status',...taskStatusEvidence(snapshot,resolveCodexRoute(profile))}) }
  catch(error) {output({ok:false,error:error.message},1)}
}

function validRunId(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

function workflowRunStart() {
  const [
    suitSlug,
    maxTasksText,
  ] = args

  const maxTasks =
    Number(maxTasksText)

  if (
    !validSuitSlug(suitSlug) ||
    !Number.isInteger(maxTasks) ||
    maxTasks < 1 ||
    maxTasks > 1000
  ) {
    output({
      ok: false,
      command: 'run-start',
      error: 'invalid_run_parameters',
    }, 64)

    return
  }

  try {
    const result =
      controlQuery(
        `
          SELECT
            control.ensure_workflow_run(
              :'suit_slug',
              :'max_tasks'::integer
            );
        `,
        {
          suit_slug: suitSlug,
          max_tasks: String(maxTasks),
        },
      )

    const run =
      parseControlJson(result)

    output({
      ok: run?.started === true,
      command: 'run-start',
      run,
    }, run?.started === true ? 0 : 1)
  }
  catch (error) {
    output({
      ok: false,
      command: 'run-start',
      error: error.message,
    }, 1)
  }
}

function workflowRunCheck() {
  const [runId] = args

  if (!validRunId(runId)) {
    output({
      ok: false,
      command: 'run-check',
      error: 'invalid_run_id',
    }, 64)

    return
  }

  try {
    const result =
      controlQuery(
        `
          SELECT
            control.workflow_run_gate(
              :'run_id'::uuid
            );
        `,
        {
          run_id: runId,
        },
      )

    output({
      ok: true,
      command: 'run-check',
      run: parseControlJson(result),
    })
  }
  catch (error) {
    output({
      ok: false,
      command: 'run-check',
      error: error.message,
    }, 1)
  }
}

function workflowRunCompleteTask() {
  const [runId, taskId, idempotencyKey] = args

  const attributed = taskId != null || idempotencyKey != null
  if (!validRunId(runId) || (attributed && (!validTaskId(taskId) || !idempotencyKey))) {
    output({
      ok: false,
      command: 'run-complete-task',
      error: 'invalid_run_id',
    }, 64)

    return
  }

  try {
    const result =
      controlQuery(
        `
          SELECT
            ${attributed
              ? `control.record_workflow_task_success(
                  :'run_id'::uuid,
                  :'task_id',
                  :'idempotency_key'
                )`
              : `control.record_workflow_task_success(:'run_id'::uuid)`};
        `,
        {
          run_id: runId,
          task_id: taskId,
          idempotency_key: idempotencyKey,
        },
      )

    output({
      ok: true,
      command: 'run-complete-task',
      run: parseControlJson(result),
    })
  }
  catch (error) {
    output({
      ok: false,
      command: 'run-complete-task',
      error: error.message,
    }, 1)
  }
}

function workflowRunAcquireTask() {
  const [runId, controllerProtocol, controllerFingerprint, controllerLeaseToken] = args
  if (!validRunId(runId) || !controllerProtocol || !controllerFingerprint || !controllerLeaseToken) {
    output({ ok:false,command:'run-acquire-task',error:'run_id_controller_protocol_fingerprint_and_lease_required' },64)
    return
  }
  try {
    const result = controlQuery(`SELECT control.acquire_workflow_run_task(:'run_id'::uuid,:'protocol',:'fingerprint',:'lease_token','runner');`, {
      run_id:runId,
      protocol:controllerProtocol,
      fingerprint:controllerFingerprint,
      lease_token:controllerLeaseToken,
    })
    const acquisition = parseControlJson(result)
    output({
      ok: acquisition?.acquired === true || acquisition?.action === 'wait_for_owner' || acquisition?.reason === 'no_admitted_task',
      command: 'run-acquire-task',
      run_id: runId,
      reason: acquisition?.reason ?? null,
      acquisition,
    }, acquisition?.acquired === true || acquisition?.action === 'wait_for_owner' || acquisition?.reason === 'no_admitted_task' ? 0 : 1)
  }
  catch (error) {
    output({ ok:false,command:'run-acquire-task',run_id:runId,error:error.message },1)
  }
}

function workflowRunStop() {
  const [suitSlug] = args

  if (!validSuitSlug(suitSlug)) {
    output({
      ok: false,
      command: 'run-stop',
      error: 'invalid_suit_slug',
    }, 64)

    return
  }

  try {
    const result =
      controlQuery(
        `
          SELECT
            control.request_workflow_stop(
              :'suit_slug'
            );
        `,
        {
          suit_slug: suitSlug,
        },
      )

    const stop =
      parseControlJson(result)

    output({
      ok: stop?.requested === true,
      command: 'run-stop',
      stop,
    }, stop?.requested === true ? 0 : 1)
  }
  catch (error) {
    output({
      ok: false,
      command: 'run-stop',
      error: error.message,
    }, 1)
  }
}

function workflowRunFinish() {
  const [
    runId,
    status,
  ] = args

  if (
    !validRunId(runId) ||
    ![
      'finished',
      'failed',
      'cancelled',
    ].includes(status)
  ) {
    output({
      ok: false,
      command: 'run-finish',
      error: 'invalid_run_finish_parameters',
    }, 64)

    return
  }

  try {
    if (status === 'failed') {
      const currentResult =
        controlQuery(
          `
            SELECT COALESCE(
              (
                SELECT jsonb_build_object(
                  'run_id', run.run_id,
                  'status', run.status,
                  'max_tasks', run.max_tasks,
                  'completed_tasks', run.completed_tasks,
                  'current_task_id', run.current_task_id,
                  'admitted_repair_id', run.admitted_repair_id,
                  'run_revision', run.run_revision,
                  'task_status', task.status
                )
                FROM control.workflow_runs run
                LEFT JOIN control.tasks task
                  ON task.task_id = run.current_task_id
                WHERE run.run_id = :'run_id'::uuid
              ),
              'null'::jsonb
            );
          `,
          {
            run_id: runId,
          },
        )

      const current =
        parseControlJson(
          currentResult,
        )

      if (
        preserveAttributedRun(current,
          current?.current_task_id ? planSupervisorStep(supervisorSnapshot(current.current_task_id)) : null,
        )
      ) {
        output({
          ok: true,
          command: 'run-finish',
          run: current,
          preserved: true,
          reason: 'attributed_incomplete_run_preserved',
        })
        return
      }
    }

    const result =
      controlQuery(
        `
          SELECT
            control.finish_workflow_run(
              :'run_id'::uuid,
              :'status'
            );
        `,
        {
          run_id: runId,
          status,
        },
      )

    output({
      ok: true,
      command: 'run-finish',
      run: parseControlJson(result),
    })
  }
  catch (error) {
    output({
      ok: false,
      command: 'run-finish',
      error: error.message,
    }, 1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
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

  case 'workstream-resolve':
    workstreamResolve()
    break

  case 'task-next':
    taskNext()
    break

  case 'task-packet':
    taskPacket()
    break

  case 'task-claim':
    taskClaim()
    break

  case 'task-release':
    taskRelease()
    break

  case 'task-prepare':
    taskPrepare()
    break

  case 'task-run':
    taskRun()
    break

  case 'task-verify':
    taskVerify()
    break

  case 'retry-route':
    retryRoute()
    break

  case 'task-retry':
    taskRetry()
    break

  case 'task-publish':
    taskPublish()
    break

  case 'task-execution-preflight':
    taskExecutionPreflight()
    break

  case 'task-supervise':
    taskSupervisor()
    break

  case 'run-refresh-admission':
    if(!validRunId(args[0])) output({ok:false,error:'valid_run_id_required'},64)
    else {try { output({ok:true,...parseControlJson(controlQuery(`SELECT control.refresh_dot_admission(:'run'::uuid);`,{run:args[0]}))}) } catch(error) {output({ok:false,error:error.message,classification:{failure_class:'operator-wait',recovery_action:'wait-operator'}},1)}}
    break

  case 'task-reaccept':
    taskReaccept()
    break

  case 'recovery-watch':
    recoveryWatch()
    break

  case 'run-recover':
    recoverWorkflowRun()
    break

  case 'task-status':
    observableTaskStatus()
    break

  case 'external-watch':
    externalWatcher()
    break

  case 'task-engine':
    taskEngine()
    break

  case 'run-start':
    workflowRunStart()
    break

  case 'run-check':
    workflowRunCheck()
    break

  case 'run-acquire-task':
  case 'run-claim-task':
    workflowRunAcquireTask()
    break

  case 'run-complete-task':
    workflowRunCompleteTask()
    break

  case 'run-stop':
    workflowRunStop()
    break

  case 'run-finish':
    workflowRunFinish()
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
        'workstream-resolve <project/workstream>',
        'task-next <suit>',
        'task-packet <task-id>',
        'task-claim <suit>',
        'task-release <task-id>',
        'task-prepare <task-id>',
        'task-run <task-id>',
        'task-verify <task-id>',
        'retry-route <profile> <previous-attempt>',
        'task-retry <task-id>',
        'task-publish <task-id>',
        'task-execution-preflight <task-id>',
        'task-supervise <task-id>',
        'external-watch [limit]',
        'task-engine <task-id>',
        'run-start <suit> <max-tasks>',
        'run-check <run-id>',
        'run-acquire-task <run-id> <controller-protocol> <controller-fingerprint> <controller-lease-token>',
        'run-complete-task <run-id> [<task-id> <idempotency-key>]',
        'run-stop <suit>',
        'run-finish <run-id> <status>',
      ],
    }, 64)
}

}
