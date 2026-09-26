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
import { fileURLToPath } from 'node:url'


const controlRoot =
  fileURLToPath(
    new URL('../../../', import.meta.url),
  )

const defaultRepository =
  'Building-Suit/building-suit-monorepo'

const [contextPath] =
  process.argv.slice(2)


function output(
  payload,
  code = 0,
) {
  process.stdout.write(
    `${JSON.stringify(payload)}\n`,
  )

  process.exit(code)
}


function fail(
  error,
  extra = {},
) {
  output(
    {
      ok: false,
      error,
      ...extra,
    },
    1,
  )
}


if (
  !contextPath ||
  !existsSync(contextPath)
) {
  fail(
    'publication_context_not_found',
  )
}


const context =
  JSON.parse(
    readFileSync(
      contextPath,
      'utf8',
    ),
  )


const {
  task,
  suit,
  execution,
  allowed_paths: allowedPaths,
  requirements,
  verification,
  project = {},
  workstream = {},
} = context

const repository =
  project.github_repository ??
  defaultRepository


const worktreePath =
  execution.worktree_path


if (
  !worktreePath ||
  !existsSync(worktreePath)
) {
  fail(
    'worktree_not_found',
  )
}


function run(
  program,
  args,
  options = {},
) {
  const result =
    spawnSync(
      program,
      args,
      {
        cwd:
          options.cwd ??
          worktreePath,

        encoding:
          'utf8',

        env: {
          ...process.env,
          NO_COLOR: '1',
          FORCE_COLOR: '0',
        },

        maxBuffer:
          50 * 1024 * 1024,

        timeout:
          options.timeout ??
          10 * 60 * 1000,
      },
    )

  return {
    code:
      typeof result.status === 'number'
        ? result.status
        : 1,

    stdout:
      (result.stdout ?? '').trim(),

    stderr:
      (result.stderr ?? '').trim(),

    error:
      result.error?.message ?? null,
  }
}


function requireSuccess(
  result,
  label,
) {
  if (
    result.code !== 0 ||
    result.error
  ) {
    fail(
      label,
      {
        exit_code:
          result.code,

        stderr:
          result.stderr,

        runtime_error:
          result.error,
      },
    )
  }

  return result.stdout
}


function git(args) {
  return run(
    'git',
    args,
  )
}


function validateAllowedPath(
  value,
) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !path.isAbsolute(value) &&
    !value
      .split('/')
      .includes('..')
  )
}


if (
  !Array.isArray(allowedPaths) ||
  allowedPaths.length === 0
) {
  fail(
    'no_allowed_paths',
  )
}


for (
  const allowedPath
  of allowedPaths
) {
  if (
    !validateAllowedPath(
      allowedPath,
    )
  ) {
    fail(
      'invalid_allowed_path',
      {
        allowed_path:
          allowedPath,
      },
    )
  }
}


function pathAllowed(file) {
  return allowedPaths.some(
    configured => {
      const prefix =
        configured.endsWith('/')
          ? configured
          : `${configured}/`

      const exact =
        configured.endsWith('/')
          ? configured.slice(0, -1)
          : configured

      return (
        file === exact ||
        file.startsWith(prefix)
      )
    },
  )
}


const currentBranch =
  requireSuccess(
    git([
      'branch',
      '--show-current',
    ]),
    'unable_to_read_branch',
  )


if (
  currentBranch !==
  execution.branch_name
) {
  fail(
    'branch_mismatch',
    {
      expected:
        execution.branch_name,

      actual:
        currentBranch,
    },
  )
}


requireSuccess(
  git([
    'fetch',
    'origin',
    '--prune',
  ]),
  'git_fetch_failed',
)


const liveParentResult =
  run(
    process.execPath,
    [
      path.join(
        controlRoot,
        'tooling',
        'control-plane',
        'runner',
        'stack-parent.mjs',
      ),

      suit.stack_key,
      project.local_repository_root ?? '.',
      repository,
      project.integration_branch ?? 'stg',
    ],
    {
      cwd:
        controlRoot,
    },
  )


requireSuccess(
  liveParentResult,
  'stack_parent_resolution_failed',
)


let liveParent

try {
  liveParent =
    JSON.parse(
      liveParentResult.stdout,
    )
}
catch {
  fail(
    'invalid_stack_parent_response',
  )
}


let parentStillCurrent =
  liveParent.parent_branch ===
    execution.parent_branch &&
  liveParent.parent_sha ===
    execution.parent_sha


// Publication may already have pushed the task branch and created its
// Draft PR before control-plane recording completed. In that case the
// stack resolver legitimately sees THIS task's own PR as the stack leaf.
//
// That is not a parent change. Validate the PR's base branch and confirm
// that the recorded parent branch still points at the execution's
// original parent SHA.
if (
  !parentStillCurrent &&
  liveParent.parent_branch ===
    execution.branch_name &&
  liveParent.parent_pr?.base_branch ===
    execution.parent_branch
) {

  const recordedParentSha =
    requireSuccess(
      git([
        'rev-parse',
        `origin/${execution.parent_branch}`,
      ]),
      'unable_to_read_recorded_parent',
    )


  parentStillCurrent =
    recordedParentSha ===
    execution.parent_sha
}


if (!parentStillCurrent) {
  fail(
    'parent_changed_since_execution',
    {
      execution_parent: {
        branch:
          execution.parent_branch,

        sha:
          execution.parent_sha,
      },

      live_parent: {
        branch:
          liveParent.parent_branch,

        sha:
          liveParent.parent_sha,
      },
    },
  )
}


const preflight =
  run(
    process.execPath,
    [
      path.join(
        worktreePath,
        'tooling',
        'git',
        'preflight.mjs',
      ),
    ],
    {
      cwd:
        worktreePath,

      timeout:
        10 * 60 * 1000,
    },
  )


requireSuccess(
  preflight,
  'preflight_failed',
)


function lines(value) {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}


const changedFiles =
  new Set()


for (
  const file
  of lines(
    requireSuccess(
      git([
        'diff',
        '--name-only',
        'HEAD',
      ]),
      'git_diff_failed',
    ),
  )
) {
  changedFiles.add(file)
}


for (
  const file
  of lines(
    requireSuccess(
      git([
        'diff',
        '--cached',
        '--name-only',
      ]),
      'git_cached_diff_failed',
    ),
  )
) {
  changedFiles.add(file)
}


for (
  const file
  of lines(
    requireSuccess(
      git([
        'ls-files',
        '--others',
        '--exclude-standard',
      ]),
      'git_untracked_files_failed',
    ),
  )
) {
  changedFiles.add(file)
}


const changed =
  [...changedFiles]
    .sort()


const outOfScope =
  changed.filter(
    file =>
      !pathAllowed(file),
  )


if (outOfScope.length > 0) {
  fail(
    'out_of_scope_changes',
    {
      allowed_paths:
        allowedPaths,

      out_of_scope:
        outOfScope,
    },
  )
}


const currentHead =
  requireSuccess(
    git([
      'rev-parse',
      'HEAD',
    ]),
    'unable_to_read_head',
  )


let commitSha =
  currentHead


if (
  currentHead !==
  execution.parent_sha
) {

  const aheadCount =
    Number(
      requireSuccess(
        git([
          'rev-list',
          '--count',
          `${execution.parent_sha}..HEAD`,
        ]),
        'unable_to_measure_branch_history',
      ),
    )


  const lastCommitBody =
    requireSuccess(
      git([
        'log',
        '-1',
        '--format=%B',
      ]),
      'unable_to_read_commit',
    )


  if (
    aheadCount !== 1 ||
    !lastCommitBody.includes(
      `Task: ${task.task_id}`,
    )
  ) {
    fail(
      'unexpected_existing_commits',
      {
        parent_sha:
          execution.parent_sha,

        head_sha:
          currentHead,

        ahead_count:
          aheadCount,
      },
    )
  }

}
else {

  if (changed.length === 0) {
    fail(
      'no_publishable_changes',
    )
  }


  requireSuccess(
    git([
      'add',
      '-A',
    ]),
    'git_add_failed',
  )


  const stagedFiles =
    lines(
      requireSuccess(
        git([
          'diff',
          '--cached',
          '--name-only',
        ]),
        'unable_to_read_staged_files',
      ),
    )


  const stagedOutOfScope =
    stagedFiles.filter(
      file =>
        !pathAllowed(file),
    )


  if (
    stagedOutOfScope.length > 0
  ) {
    fail(
      'staged_out_of_scope_changes',
      {
        out_of_scope:
          stagedOutOfScope,
      },
    )
  }


  const commitTypes = {
    feature:
      'feat',

    bug:
      'fix',

    database:
      'feat',

    docs:
      'docs',

    research:
      'docs',

    review:
      'chore',

    release:
      'chore',

    maintenance:
      'chore',
  }


  const commitType =
    commitTypes[
      task.task_type
    ] ?? 'chore'


  const subject =
    `${commitType}(${suit.stack_key}): ${task.title}`


  const commit =
    run(
      'git',
      [
        'commit',
        '-m',
        subject,
        '-m',
        `Task: ${task.task_id}`,
      ],
    )


  requireSuccess(
    commit,
    'git_commit_failed',
  )


  commitSha =
    requireSuccess(
      git([
        'rev-parse',
        'HEAD',
      ]),
      'unable_to_read_commit_sha',
    )

}


const remoteBranch =
  run(
    'git',
    [
      'ls-remote',
      '--heads',
      'origin',
      `refs/heads/${execution.branch_name}`,
    ],
  )


requireSuccess(
  remoteBranch,
  'unable_to_inspect_remote_branch',
)


const remoteLine =
  remoteBranch.stdout.trim()


if (!remoteLine) {

  requireSuccess(
    git([
      'push',
      '-u',
      'origin',
      `HEAD:refs/heads/${execution.branch_name}`,
    ]),
    'git_push_failed',
  )

}
else {

  const remoteSha =
    remoteLine
      .split(/\s+/)[0]


  if (
    remoteSha !==
    commitSha
  ) {
    fail(
      'remote_branch_sha_mismatch',
      {
        local_sha:
          commitSha,

        remote_sha:
          remoteSha,
      },
    )
  }

}


const publicationDirectory =
  path.dirname(
    contextPath,
  )


mkdirSync(
  publicationDirectory,
  {
    recursive: true,
  },
)


const requirementIds =
  (requirements ?? [])
    .map(item => item.id)


const verificationLines =
  (verification ?? [])
    .map(
      item =>
        `- ${item.check_name}: ${item.status.toUpperCase()}`,
    )


const parentDescription =
  liveParent.parent_pr
    ? `#${liveParent.parent_pr.number} (${liveParent.parent_branch})`
    : `${project.integration_branch ?? 'stg'} (${liveParent.parent_sha.slice(0, 12)})`


const prBody =
`## Task

- Task: \`${task.task_id}\`
- Project: \`${project.slug ?? 'building-suit'}\`
- Workstream: \`${workstream.slug ?? suit.slug}\`
- Stack: \`${suit.stack_key}\`
- Parent: ${parentDescription}

## Scope

${task.title}

${task.description ?? ''}

## Requirements

${
  requirementIds.length > 0
    ? requirementIds
        .map(
          id => `- \`${id}\``,
        )
        .join('\n')
    : '- No explicitly linked requirement IDs.'
}

## Verification

${
  verificationLines.length > 0
    ? verificationLines.join('\n')
    : '- No verification evidence supplied.'
}

## Publication

- Commit: \`${commitSha}\`
- Draft PR: yes
- Deployment: none
- Hosted database changes: none

Do not merge without separate authorization.
`


const bodyPath =
  path.join(
    publicationDirectory,
    'pr-body.md',
  )


writeFileSync(
  bodyPath,
  prBody,
  {
    mode: 0o600,
  },
)


const commitTypeForPr =
  {
    feature: 'feat',
    bug: 'fix',
    database: 'feat',
    docs: 'docs',
    research: 'docs',
    review: 'chore',
    release: 'chore',
    maintenance: 'chore',
  }[
    task.task_type
  ] ?? 'chore'


const prTitle =
  `${commitTypeForPr}(${suit.stack_key}): ${task.title}`


const existingPrResult =
  run(
    'gh',
    [
      'pr',
      'list',
      '--repo',
      repository,
      '--state',
      'open',
      '--head',
      execution.branch_name,
      '--json',
      [
        'number',
        'headRefName',
        'baseRefName',
        'isDraft',
        'url',
      ].join(','),
    ],
    {
      cwd:
        controlRoot,
    },
  )


requireSuccess(
  existingPrResult,
  'unable_to_find_existing_pr',
)


let existingPrs

try {
  existingPrs =
    JSON.parse(
      existingPrResult.stdout,
    )
}
catch {
  fail(
    'invalid_existing_pr_response',
  )
}


if (existingPrs.length > 1) {
  fail(
    'multiple_open_prs_for_branch',
  )
}


let pr


if (
  existingPrs.length === 1
) {

  pr =
    existingPrs[0]


  if (
    pr.baseRefName !==
    execution.parent_branch
  ) {
    fail(
      'existing_pr_has_wrong_base',
      {
        expected:
          execution.parent_branch,

        actual:
          pr.baseRefName,

        pr_number:
          pr.number,
      },
    )
  }

}
else {

  const createResult =
    run(
      'gh',
      [
        'pr',
        'create',

        '--repo',
        repository,

        '--base',
        execution.parent_branch,

        '--head',
        execution.branch_name,

        '--draft',

        '--title',
        prTitle,

        '--body-file',
        bodyPath,
      ],
      {
        cwd:
          controlRoot,
      },
    )


  requireSuccess(
    createResult,
    'pr_create_failed',
  )


  const viewResult =
    run(
      'gh',
      [
        'pr',
        'view',

        execution.branch_name,

        '--repo',
        repository,

        '--json',
        [
          'number',
          'headRefName',
          'baseRefName',
          'isDraft',
          'url',
        ].join(','),
      ],
      {
        cwd:
          controlRoot,
      },
    )


  requireSuccess(
    viewResult,
    'unable_to_read_created_pr',
  )


  try {
    pr =
      JSON.parse(
        viewResult.stdout,
      )
  }
  catch {
    fail(
      'invalid_created_pr_response',
    )
  }

}


const prCheck =
  run(
    process.execPath,
    [
      path.join(
        controlRoot,
        'tooling',
        'git',
        'check-pr.mjs',
      ),

      String(
        pr.number,
      ),
    ],
    {
      cwd:
        controlRoot,

      timeout:
        10 * 60 * 1000,
    },
  )


if (
  prCheck.code !== 0 ||
  prCheck.error
) {
  fail(
    'pr_check_failed',
    {
      pr,
      commit_sha:
        commitSha,

      stderr:
        prCheck.stderr,

      stdout:
        prCheck.stdout,
    },
  )
}


output({
  ok: true,

  task_id:
    task.task_id,

  commit_sha:
    commitSha,

  changed_files:
    changed,

  allowed_paths:
    allowedPaths,

  pr: {
    number:
      pr.number,

    head_branch:
      pr.headRefName,

    base_branch:
      pr.baseRefName,

    is_draft:
      pr.isDraft,

    url:
      pr.url,
  },

  pr_check: {
    passed: true,
  },
})
