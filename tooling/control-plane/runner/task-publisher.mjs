#!/usr/bin/env node
import { unattendedSensitiveFiles, frozenDraftReplay } from './unattended-publication.mjs'
import { ordinaryRunAuthority } from './bounded-publication.mjs'

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
import {
  classifyPublicationFiles,
  verifiedProtectedPublicationPaths,
  protectedPublicationPath,
  evaluatePublicationParent,
  evaluateVerificationAuthority,
  planPublicationReconciliation,
  publicationStateFingerprint,
  validPublicationPath,
} from './publication-preflight.mjs'


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
  publication_boundaries: publicationBoundaries = {},
  publication_contract: publicationContract = {},
  publication_authorizations: publicationAuthorizations = {},
  project = {},
  workstream = {},
} = context

const contractRequiredPaths = (publicationContract.required_paths ?? [])
  .map(item => typeof item === 'string' ? item : item?.path)
  .filter(Boolean)
const authorizationPaths = authorizations => (authorizations ?? []).flatMap(item =>
  item.revoked_at ? [] : (item.authorized_paths ?? item.requested_paths ?? []),
)
const ordinaryAuthorizedPaths = authorizationPaths(publicationAuthorizations.ordinary)
const protectedAuthorizedPaths = authorizationPaths(publicationAuthorizations.protected)
const verifiedProtectedPaths = verifiedProtectedPublicationPaths({grant:context.protected_publication_authority,task,execution,verification})

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
  return validPublicationPath(value)
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
  of [
    ...allowedPaths,
    ...(publicationBoundaries.task_paths ?? []),
    ...(publicationBoundaries.source_paths ?? []),
    ...(publicationBoundaries.workstream_paths ?? []),
    ...(publicationBoundaries.project_paths ?? []),
  ]
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


if (ordinaryRunAuthority(context.run_publication_authority, task.task_id)) {
  if (!execution.branch_name.startsWith(`codex/${suit.stack_key}/`) || ['main','stg',project.integration_branch].includes(execution.branch_name)) {
    fail('publication_branch_operator_wait', { classification: { failure_class: 'operator-wait', recovery_action: 'wait-operator' } })
  }
  const existing = run('gh', ['pr','list','--repo',repository,'--head',execution.branch_name,'--state','open','--json','number,isDraft,baseRefName'])
  requireSuccess(existing, 'unable_to_inspect_draft_publication')
  let prs
  try { prs = JSON.parse(existing.stdout) } catch { fail('invalid_draft_publication_response') }
  if (prs.some(pr => pr.isDraft !== true)) {
    fail('publication_nondraft_operator_wait', { classification: { failure_class: 'operator-wait', recovery_action: 'wait-operator' } })
  }
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
        worktreePath,
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


let recordedParentSha = null


// Publication may already have pushed the task branch and created its
// Draft PR before control-plane recording completed. In that case the
// stack resolver legitimately sees THIS task's own PR as the stack leaf.
//
// That is not a parent change. Validate the PR's base branch and confirm
// that the recorded parent branch still points at the execution's
// original parent SHA.
if (
  liveParent.parent_branch ===
    execution.branch_name &&
  liveParent.parent_pr?.base_branch ===
    execution.parent_branch
) {

  recordedParentSha =
    requireSuccess(
      git([
        'rev-parse',
        `origin/${execution.parent_branch}`,
      ]),
      'unable_to_read_recorded_parent',
    )

}

const parentEvaluation = evaluatePublicationParent({
  liveParent,
  execution,
  recordedParentSha,
  parentDescendant: (liveParent.parent_branch===execution.parent_branch || recordedParentSha!==null) && git(['merge-base','--is-ancestor',execution.parent_sha,recordedParentSha ?? liveParent.parent_sha]).code===0,
})

let frozenDraftReconciliation = false
if (!parentEvaluation.current && context.run_publication_authority?.unattended_queue_authority === true) {
  const existing = run('gh', ['pr','list','--repo',repository,'--head',execution.branch_name,'--state','open','--json','number,state,isDraft,headRefName,headRefOid,baseRefName'])
  requireSuccess(existing,'unable_to_inspect_draft_publication')
  let drafts
  try { drafts = JSON.parse(existing.stdout) } catch { fail('invalid_draft_publication_response') }
  const remote = requireSuccess(git(['ls-remote','--heads','origin',`refs/heads/${execution.branch_name}`]),'unable_to_inspect_remote_branch').trim().split(/\s+/)[0]
  const parent = git(['rev-parse',`origin/${execution.parent_branch}`])
  const replayHead = requireSuccess(git(['rev-parse','HEAD']),'unable_to_read_head').trim()
  frozenDraftReconciliation = drafts.length===1 && requireSuccess(git(['status','--porcelain','--untracked-files=all']),'unable_to_read_worktree_status').trim()==='' && frozenDraftReplay({pr:drafts[0],execution,localSha:replayHead,remoteSha:remote,recordedParentSha:parent.code===0?parent.stdout.trim():null,taskCommitsOnly:taskCommitsOnly(execution.parent_sha,'HEAD')})
}
if (!parentEvaluation.current && !frozenDraftReconciliation) {
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

function taskCommitsOnly(
  baseSha,
  tip,
) {
  const ancestry = git(['merge-base', '--is-ancestor', baseSha, tip])
  if (ancestry.code !== 0) return false
  const bodies = requireSuccess(
    git(['log', '--format=%B%x1e', `${baseSha}..${tip}`]),
    'unable_to_read_existing_commits',
  ).split('\x1e').map(body => body.trim()).filter(Boolean)
  return bodies.length > 0 && bodies.every(body => body.includes(`Task: ${task.task_id}`))
}

let currentHead = requireSuccess(
  git(['rev-parse', 'HEAD']),
  'unable_to_read_head',
)

const remoteBranch = run('git', [
  'ls-remote', '--heads', 'origin', `refs/heads/${execution.branch_name}`,
])
requireSuccess(remoteBranch, 'unable_to_inspect_remote_branch')
let remoteSha = remoteBranch.stdout.trim()
  ? remoteBranch.stdout.trim().split(/\s+/)[0]
  : null

let reconciliation = {
  remote_branch_found: Boolean(remoteSha),
  local_head_before: currentHead,
  actions: [],
}

if (
  remoteSha &&
  currentHead === execution.parent_sha &&
  remoteSha !== currentHead
) {
  const remoteRef = `origin/${execution.branch_name}`
  if (!taskCommitsOnly(execution.parent_sha, remoteRef)) {
    fail('remote_branch_not_unambiguous_task_lineage', { remote_sha: remoteSha })
  }
  requireSuccess(
    git(['merge', '--ff-only', remoteRef]),
    'unable_to_fast_forward_task_branch',
  )
  currentHead = requireSuccess(git(['rev-parse', 'HEAD']), 'unable_to_read_head')
  reconciliation.actions.push('fast_forwarded_unambiguous_remote_task_branch')
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
        execution.parent_sha,
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

if (context.run_publication_authority?.unattended_queue_authority === true) {
  const sensitive = unattendedSensitiveFiles(changed)
  if (sensitive.length) fail('publication_security_sensitive_operator_wait', { protected_paths: sensitive, classification: { failure_class: 'operator-wait', recovery_action: 'wait-operator' } })
}

const scopeClassification = classifyPublicationFiles({
  files: changed,
  task,
  taskPaths: publicationBoundaries.task_paths ?? [],
  ordinaryRunAuthorized: ordinaryRunAuthority(context.run_publication_authority, task.task_id),
  sourcePaths: publicationBoundaries.source_paths ?? [],
  workstreamPaths: publicationBoundaries.workstream_paths ?? allowedPaths,
  projectPaths: publicationBoundaries.project_paths ?? [],
  requiredPaths: contractRequiredPaths,
  ordinaryAuthorizedPaths,
  protectedAuthorizedPaths,
  verifiedProtectedPaths,
})

if (ordinaryRunAuthority(context.run_publication_authority, task.task_id) && changed.some(file => protectedPublicationPath(file) && !verifiedProtectedPaths.includes(file))) {
  fail('publication_protected_path_operator_wait', { protected_paths: changed.filter(file => protectedPublicationPath(file) && !verifiedProtectedPaths.includes(file)), classification: { failure_class: 'operator-wait', recovery_action: 'wait-operator' } })
}

if (scopeClassification.blocked.length > 0) {
  fail('publication_scope_safety_stop', { classification: scopeClassification })
}
if (scopeClassification.waiting.length > 0) {
  fail('publication_scope_operator_wait', { classification: scopeClassification })
}

const stateFiles = changed.map(file => ({
  file,
  object: existsSync(path.join(worktreePath, file))
    ? requireSuccess(git(['hash-object', '--', file]), 'unable_to_hash_publication_file')
    : 'deleted',
}))
const stateFingerprint = publicationStateFingerprint({
  base_sha: verification?.verified_state?.base_sha ?? execution.parent_sha,
  files: stateFiles,
})
const verificationAuthority = evaluateVerificationAuthority({
  verification,
  executionId: execution.execution_id,
  stateFingerprint,
})
if (!verificationAuthority.authoritative) {
  fail('publication_verification_not_authoritative', {
    verification_run_id: verification?.verification_run_id ?? null,
    reason: verificationAuthority.reason,
  })
}

reconciliation = {
  ...reconciliation,
  local_head_after: currentHead,
  scope_repairs: scopeClassification.repaired,
  verification_run_id: verification.verification_run_id,
  state_fingerprint: stateFingerprint,
}


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


  if (
    aheadCount < 1 ||
    !taskCommitsOnly(execution.parent_sha, 'HEAD')
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


  const stagedClassification = classifyPublicationFiles({
    files: stagedFiles,
    task,
    taskPaths: publicationBoundaries.task_paths ?? [],
  ordinaryRunAuthorized: ordinaryRunAuthority(context.run_publication_authority, task.task_id),
    sourcePaths: publicationBoundaries.source_paths ?? [],
    workstreamPaths: publicationBoundaries.workstream_paths ?? allowedPaths,
    projectPaths: publicationBoundaries.project_paths ?? [],
    requiredPaths: contractRequiredPaths,
    ordinaryAuthorizedPaths,
    protectedAuthorizedPaths,
  verifiedProtectedPaths,
  })

  if (stagedClassification.waiting.length > 0 || stagedClassification.blocked.length > 0) {
    fail(
      'staged_out_of_scope_changes',
      {
        classification: stagedClassification,
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


if (!remoteSha) {

  requireSuccess(
    git([
      'push',
      '-u',
      'origin',
      `HEAD:refs/heads/${execution.branch_name}`,
    ]),
    'git_push_failed',
  )

  remoteSha = commitSha
  reconciliation.actions.push('pushed_task_branch')

}
else {

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
  (verification?.checks ?? [])
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
        worktreePath,
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

const reconciliationPlan = planPublicationReconciliation({
  parentSha: execution.parent_sha,
  localSha: commitSha,
  remoteSha: remoteSha ?? commitSha,
  localTaskCommits: taskCommitsOnly(execution.parent_sha, 'HEAD'),
  remoteTaskCommits: remoteSha
    ? taskCommitsOnly(execution.parent_sha, `origin/${execution.branch_name}`)
    : false,
  existingPrs,
  expectedBase: execution.parent_branch,
})

if (['wait', 'safety-stop'].includes(reconciliationPlan.action)) {
  fail(reconciliationPlan.reason, { reconciliation_plan: reconciliationPlan })
}

reconciliation.actions.push(reconciliationPlan.action)


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
          worktreePath,
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
          worktreePath,
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
      '--repository',
      repository,
    ],
    {
      cwd:
        worktreePath,

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

  verification_run_id:
    verification.verification_run_id,

  reconciliation,

  preflight: {
    parent: {
      branch: execution.parent_branch,
      sha: execution.parent_sha,
    },
    classification: scopeClassification.decisions,
    verification: verificationAuthority,
  },

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
