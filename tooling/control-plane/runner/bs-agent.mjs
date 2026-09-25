#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  existsSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getProfile,
  listProfiles,
  resolveProfile,
} from '../routing/router.mjs'
import {
  profileForAttempt,
  retryDecision,
  validateRetryPolicy,
} from '../lib/retry-policy.mjs'
import {
  redact,
  redactText,
} from '../lib/redaction.mjs'

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

  return execute(
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
  )
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
      relativePath,
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
  const result =
    controlQuery(
      `
        WITH started AS (
          SELECT control.start_execution(
            :'task_id',
            :'model_profile',
            :'model_name',
            :'reasoning_effort',
            :'worktree_path',
            :'branch_name',
            :'parent_branch',
            :'parent_sha'
          ) AS execution_id
        ), recorded AS (
          UPDATE control.executions e
          SET resolved_retry_policy = :'retry_policy'::jsonb,
              prompt_path = :'prompt_path',
              engine_stage = 'implementation'
          FROM started
          WHERE e.execution_id = started.execution_id
          RETURNING e.execution_id
        )
        SELECT jsonb_build_object('execution_id', execution_id)
        FROM recorded;
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

        retry_policy:
          JSON.stringify(retryPolicy),

        prompt_path:
          promptPath,
      },
    )

  return parseControlJson(
    result,
  ).execution_id
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

    const route =
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
            repoRoot,
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

    const prompt =
      promptResult.stdout

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
    recordControlFailure(
      taskId,
      'implementation',
      error.message,
    )
    output({
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
      ? retryDecision(policy, execution.attempt)
      : { allowed: false }
    const legalActions = ['inspect', 'error-bundle', 'resume']
    if (stage === 'verification') legalActions.push('reverify')
    if (decision.allowed) legalActions.push('retry')
    if (stage === 'publication') legalActions.push('publish', 'reparent')
    controlQuery(
      `
        INSERT INTO control.failures(
          project_id,workstream_slug,task_id,execution_id,attempt,stage,error_code,
          summary,raw_error,retry_available,next_profile,human_intervention_required,
          legal_actions,metadata
        )
        SELECT t.project_id,t.workstream_slug,t.task_id,
          NULLIF(:'execution_id','')::bigint,NULLIF(:'attempt','')::integer,:'stage',:'error_code',
          :'summary',:'raw_error',:'retry_available'::boolean,NULLIF(:'next_profile',''),
          :'human_required'::boolean,:'legal_actions'::jsonb,:'metadata'::jsonb
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
        retry_available: decision.allowed ? 'true' : 'false',
        next_profile: decision.next_profile ?? '',
        human_required: ['publication','reparent'].includes(stage) ? 'true' : 'false',
        legal_actions: JSON.stringify(legalActions),
        metadata: JSON.stringify(safeMetadata),
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
) {
  const result =
    controlQuery(
      `
        SELECT jsonb_build_object(
          'verification_run_id',
          control.start_verification_run(
            :'task_id',
            :'execution_id'::bigint,
            'runner'
          )
        );
      `,
      {
        task_id:
          taskId,

        execution_id:
          String(executionId),
      },
    )

  return parseControlJson(
    result,
  )
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
            :'required'::boolean
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
  const [taskId] = args

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

    const verificationDirectory =
      path.join(
        execution.worktree_path,
        '.local',
        'agent-runs',
        taskId,
        'verification',
      )

    const verificationRun =
      beginVerification(
      taskId,
      execution.execution_id,
    )

    const verificationRunId =
      verificationRun.verification_run_id

    queueVerificationChecks(
      verificationRunId,
    )

    const verifier =
      execute(
        process.execPath,
        [
          path.join(
            repoRoot,
            'tooling',
            'control-plane',
            'runner',
            'task-verifier.mjs',
          ),

          execution.worktree_path,
          packetPath,
          verificationDirectory,
          String(verificationRunId),
        ],
        {
          cwd:
            execution.worktree_path,

          timeout:
            60 * 60 * 1000,
        },
      )

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
    }

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
        { verification_run_id: verificationRunId, checks: verification.checks },
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

      result:
        finalResult,

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
    recordControlFailure(
      taskId,
      'verification',
      error.message,
    )
    output({
      ok: false,
      command:
        'task-verify',
      task_id:
        taskId,
      error:
        error.message,
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
                log_path
            )
            ORDER BY verification_id
          ),
          '[]'::jsonb
        )
        FROM control.verification_results
        WHERE execution_id =
          :'execution_id'::bigint
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

function startRetryExecution(
  taskId,
  route,
  retryPolicy,
) {
  const result =
    controlQuery(
      `
        WITH started AS (
          SELECT control.start_retry_execution(
            :'task_id',
            :'max_attempts'::integer,
            :'model_profile',
            :'model_name',
            :'reasoning_effort'
          ) AS payload
        ), recorded AS (
          UPDATE control.executions e
          SET resolved_retry_policy = :'retry_policy'::jsonb,
              engine_stage = 'implementation'
          FROM started
          WHERE e.execution_id = (started.payload->>'execution_id')::bigint
          RETURNING e.execution_id
        )
        SELECT payload FROM started;
      `,
      {
        task_id:
          taskId,

        max_attempts:
          String(retryPolicy.max_attempts),

        model_profile:
          route.profile,

        model_name:
          route.model,

        reasoning_effort:
          route.reasoning_effort,

        retry_policy:
          JSON.stringify(retryPolicy),
      },
    )

  return parseControlJson(
    result,
  )
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
  let prompt = ''
  let logPath = null
  let executionFinished = false

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
      'failed'
    ) {
      throw new Error(
        `Task ${taskId} is ${packet.task.status}, not failed.`,
      )
    }

    const previousExecution =
      latestExecution(
        taskId,
      )

    if (!previousExecution) {
      throw new Error(
        'Task has no previous execution.',
      )
    }

    const retryPolicy =
      validateRetryPolicy(
        packet.retry_policy,
      )

    const decision =
      retryDecision(
        retryPolicy,
        previousExecution.attempt,
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

    const route =
      resolveCodexRoute(
        nextProfile,
      )

    const failures =
      verificationFailures(
        previousExecution.execution_id,
      )

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
          failures,
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

    prompt =
      `
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
- Run only focused local checks needed while repairing.
- Leave final verification to the control plane.

Return a concise repair summary.
      `.trim()

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

          prompt,
        ],

        codexExecutionOptions({
          cwd:
            retry.worktree_path,

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
      Date.now() -
      startedAt

    const succeeded =
      successful(
        codexResult,
      )

    finishExecution({
      executionId:
        newExecutionId,

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
        retry: true,

        previous_execution_id:
          previousExecution.execution_id,

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

    executionFinished =
      true

    if (!succeeded) {
      recordControlFailure(
        taskId,
        'repair',
        codexResult.stderr || 'codex_repair_failed',
        { exit_code: codexResult.code, log_path: logPath },
      )
    }

    output({
      ok:
        succeeded,

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
          codexResult.code,

        elapsed_ms:
          elapsedMs,

        log_path:
          logPath,
      },
    }, succeeded ? 0 : 1)
  }
  catch (error) {

    if (
      newExecutionId &&
      !executionFinished
    ) {
      try {
        finishExecution({
          executionId:
            newExecutionId,

          status:
            'failed',

          promptBytes:
            Buffer.byteLength(
              prompt,
              'utf8',
            ),

          outputBytes:
            0,

          runLogPath:
            logPath ?? '',

          metadata: {
            retry: true,
            infrastructure_error:
              error.message,
          },
        })
      }
      catch {
        // Preserve the original error.
      }
    }

    recordControlFailure(
      taskId,
      'repair',
      error.message,
    )

    output({
      ok: false,

      command:
        'task-retry',

      task_id:
        taskId,

      execution_id:
        newExecutionId,

      error:
        error.message,
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
                summary
            )
            ORDER BY verification_id
          ),
          '[]'::jsonb
        )
        FROM control.verification_results
        WHERE execution_id =
          :'execution_id'::bigint;
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
          }),
      },
    )

  return parseControlJson(
    result,
  )
}

function taskPublish() {
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


    if (
      execution.status !==
      'succeeded'
    ) {
      throw new Error(
        `Latest execution is ${execution.status}, not succeeded.`,
      )
    }


    const verification =
      publicationVerification(
        execution.execution_id,
      )


    if (
      verification.length === 0
    ) {
      throw new Error(
        'Task has no verification evidence.',
      )
    }


    const blockingVerification =
      verification.filter(
        check =>
          check.status === 'fail' ||
          check.status === 'not_run',
      )


    if (
      blockingVerification.length > 0
    ) {
      throw new Error(
        'Task has blocking verification results.',
      )
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


    const allowedPaths =
      configuredAllowedPaths.length > 0
        ? configuredAllowedPaths
        : (
            Array.isArray(
              packet.project?.allowed_publication_paths,
            ) &&
            packet.project.allowed_publication_paths.length > 0
              ? packet.project.allowed_publication_paths
              : packet.suit.app_path
              ? [
                  `${packet.suit.app_path}/`,
                ]
              : []
          )


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
            repoRoot,
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


function invokeTaskAction(
  action,
  taskId,
) {
  const result =
    execute(
      process.execPath,
      [
        agentScriptPath,
        action,
        taskId,
      ],
      {
        cwd:
          repoRoot,

        timeout:
          70 * 60 * 1000,
      },
    )

  return {
    result,

    payload:
      parseJson(
        result.stdout,
        null,
      ),
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
            execution.attempt,
          )

        if (!decision.allowed) {
          output({
            ok: false,

            command:
              'task-engine',

            task_id:
              taskId,

            error:
              'retry_limit_reached',

            attempt:
              execution.attempt,

            max_attempts:
              retryPolicy.max_attempts,

            retry_policy:
              retryPolicy,

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
            control.start_workflow_run(
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
  const [runId] = args

  if (!validRunId(runId)) {
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
            control.record_workflow_task_success(
              :'run_id'::uuid
            );
        `,
        {
          run_id: runId,
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

  case 'task-engine':
    taskEngine()
    break

  case 'run-start':
    workflowRunStart()
    break

  case 'run-check':
    workflowRunCheck()
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
        'run-start <suit> <max-tasks>',
        'run-check <run-id>',
        'run-complete-task <run-id>',
        'run-stop <suit>',
        'run-finish <run-id> <status>',
      ],
    }, 64)
}
