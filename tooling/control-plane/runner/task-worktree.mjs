#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
} from 'node:fs'

import {
  spawnSync,
} from 'node:child_process'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const controlRoot =
  fileURLToPath(
    new URL('../../../', import.meta.url),
  )

const commonGitDirResult =
  spawnSync(
    'git',
    [
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    ],
    {
      cwd: controlRoot,
      encoding: 'utf8',
    },
  )

if (commonGitDirResult.status !== 0) {
  throw new Error(
    'Unable to resolve common Git directory.',
  )
}

const commonGitDir =
  commonGitDirResult.stdout.trim()

const repositoryRoot =
  path.dirname(commonGitDir)

const [
  taskId,
  stackKey,
  parentSha,
] = process.argv.slice(2)

function fail(message, extra = {}) {
  process.stdout.write(
    `${JSON.stringify({
      ok: false,
      error: message,
      ...extra,
    })}\n`,
  )

  process.exit(1)
}

if (
  !taskId ||
  !/^[A-Z][A-Z0-9-]{2,63}$/.test(taskId)
) {
  fail('valid_task_id_required')
}

if (
  !stackKey ||
  !/^[a-z][a-z0-9-]{1,63}$/.test(stackKey)
) {
  fail('valid_stack_key_required')
}

if (
  !parentSha ||
  !/^[0-9a-f]{40}$/.test(parentSha)
) {
  fail('valid_parent_sha_required')
}

const taskSlug =
  taskId.toLowerCase()

const branchName =
  `codex/${stackKey}/${taskSlug}`

const worktreePath =
  path.join(
    repositoryRoot,
    '.local',
    'worktrees',
    `${stackKey}-${taskSlug}`,
  )

if (existsSync(worktreePath)) {
  fail(
    'worktree_path_already_exists',
    {
      worktree_path:
        worktreePath,
    },
  )
}

const branchCheck =
  spawnSync(
    'git',
    [
      'show-ref',
      '--verify',
      '--quiet',
      `refs/heads/${branchName}`,
    ],
    {
      cwd: repositoryRoot,
    },
  )

if (branchCheck.status === 0) {
  fail(
    'local_branch_already_exists',
    {
      branch_name:
        branchName,
    },
  )
}

mkdirSync(
  path.dirname(worktreePath),
  {
    recursive: true,
  },
)

const result =
  spawnSync(
    'git',
    [
      'worktree',
      'add',
      worktreePath,
      '-b',
      branchName,
      parentSha,
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    },
  )

if (result.status !== 0) {
  fail(
    'git_worktree_add_failed',
    {
      stderr:
        (result.stderr ?? '').trim(),
    },
  )
}

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    task_id:
      taskId,
    stack_key:
      stackKey,
    branch_name:
      branchName,
    parent_sha:
      parentSha,
    worktree_path:
      worktreePath,
  })}\n`,
)
