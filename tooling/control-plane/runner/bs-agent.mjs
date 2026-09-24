#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

const githubRepository = 'Building-Suit/building-suit-monorepo'

const [command, ...args] = process.argv.slice(2)

function execute(program, programArgs = [], options = {}) {
  const result = spawnSync(program, programArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
    maxBuffer: 10 * 1024 * 1024,
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

  default:
    output({
      ok: false,
      error: 'unknown_command',
      allowed_commands: [
        'ping',
        'repo-state',
        'preflight',
        'pr-check <number>',
      ],
    }, 64)
}
