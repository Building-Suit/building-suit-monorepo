#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
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

const automationCodexHome =
  process.env.BS_CODEX_HOME ??
  path.join(
    os.homedir(),
    'Services',
    'building-suit-monorepo-plane',
    'codex-home',
  )

const controlDatabase = {
  host: '127.0.0.1',
  port: '54329',
  database: 'building_suit_control',
  user: 'bs_control_app',
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
          control.task_packet(
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

function resolveStackParent(stackKey) {
  return runJsonHelper(
    'tooling/control-plane/runner/stack-parent.mjs',
    [
      stackKey,
    ],
  )
}

function prepareTaskWorktree(
  taskId,
  stackKey,
  parentSha,
) {
  return runJsonHelper(
    'tooling/control-plane/runner/task-worktree.mjs',
    [
      taskId,
      stackKey,
      parentSha,
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
            control.task_packet(
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

    const parent =
      resolveStackParent(
        stackKey,
      )

    const prepared =
      prepareTaskWorktree(
        taskId,
        stackKey,
        parent.parent_sha,
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
}) {
  const result =
    controlQuery(
      `
        SELECT jsonb_build_object(
          'execution_id',
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
            control.task_packet(
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

    const parent =
      resolveStackParent(
        packet.suit.stack_key,
      )

    const worktree =
      prepareTaskWorktree(
        taskId,
        packet.suit.stack_key,
        parent.parent_sha,
      )

    const route =
      packet.task.model_profile ===
      'no_ai'
        ? resolveProfile(
            'no_ai',
            [],
          )
        : resolveCodexRoute(
            packet.task.model_profile,
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
      ],
    }, 64)
}
