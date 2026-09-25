#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const controlRoot =
  fileURLToPath(
    new URL('../../../', import.meta.url),
  )

const [
  stackKey,
  configuredRepoRoot,
  configuredRepository,
  configuredIntegrationBranch,
] =
  process.argv.slice(2)

const repoRoot = path.resolve(
  controlRoot,
  configuredRepoRoot ?? '.',
)

const repository =
  configuredRepository ??
  'Building-Suit/building-suit-monorepo'

const integrationBranch =
  configuredIntegrationBranch ?? 'stg'

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
  !stackKey ||
  !/^[a-z][a-z0-9-]{1,63}$/.test(stackKey)
) {
  fail('valid_stack_key_required')
}

function run(program, args) {
  const result = spawnSync(
    program,
    args,
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      maxBuffer:
        20 * 1024 * 1024,
    },
  )

  if (result.status !== 0) {
    fail(
      `${program} failed`,
      {
        stderr:
          (result.stderr ?? '').trim(),
      },
    )
  }

  return (result.stdout ?? '').trim()
}

run(
  'git',
  [
    'fetch',
    'origin',
    '--prune',
  ],
)

const rawPrs = run(
  'gh',
  [
    'pr',
    'list',
    '--repo',
    repository,
    '--state',
    'open',
    '--limit',
    '200',
    '--json',
    [
      'number',
      'headRefName',
      'baseRefName',
      'isDraft',
      'url',
    ].join(','),
  ],
)

const allPrs = JSON.parse(rawPrs)

const prefix =
  `codex/${stackKey}/`

const stackPrs = allPrs.filter(
  pr =>
    pr.headRefName.startsWith(prefix),
)

if (stackPrs.length === 0) {
  const parentSha = run(
    'git',
    [
      'rev-parse',
      `origin/${integrationBranch}`,
    ],
  )

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      stack_key: stackKey,
      parent_type: 'integration',
      parent_branch: integrationBranch,
      parent_remote_ref: `origin/${integrationBranch}`,
      parent_sha: parentSha,
      parent_pr: null,
    })}\n`,
  )

  process.exit(0)
}

const branchesWithChildren =
  new Set(
    stackPrs
      .filter(
        pr =>
          pr.baseRefName.startsWith(prefix),
      )
      .map(
        pr => pr.baseRefName,
      ),
  )

const leaves =
  stackPrs.filter(
    pr =>
      !branchesWithChildren.has(
        pr.headRefName,
      ),
  )

if (leaves.length !== 1) {
  fail(
    'ambiguous_stack_leaf',
    {
      stack_key: stackKey,

      leaves:
        leaves.map(
          pr => ({
            number: pr.number,
            head: pr.headRefName,
            base: pr.baseRefName,
          }),
        ),
    },
  )
}

const leaf = leaves[0]

const remoteRef =
  `origin/${leaf.headRefName}`

const parentSha = run(
  'git',
  [
    'rev-parse',
    remoteRef,
  ],
)

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    stack_key: stackKey,
    parent_type: 'stack_leaf',
    parent_branch:
      leaf.headRefName,
    parent_remote_ref:
      remoteRef,
    parent_sha: parentSha,
    parent_pr: {
      number: leaf.number,
      base_branch:
        leaf.baseRefName,
      is_draft:
        leaf.isDraft,
      url:
        leaf.url,
    },
  })}\n`,
)
