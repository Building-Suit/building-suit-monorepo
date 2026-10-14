#!/usr/bin/env node
import {resolveVerificationPlan} from './verification-mode.mjs'
import {mergeVerificationConfig} from '../lib/workstream-readiness.mjs'

import {
  readFileSync,
} from 'node:fs'

const [packetPath] =
  process.argv.slice(2)

if (!packetPath) {
  process.stderr.write(
    'Task packet path is required.\n',
  )

  process.exit(64)
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

const project =
  packet.project ?? {}

const workstream =
  packet.workstream ?? suit

const requirementIds =
  (packet.requirements ?? [])
    .map(item => item.id)
    .join(', ')

const decisionIds =
  (packet.decisions ?? [])
    .map(item => item.id)
    .join(', ')

const configuration=mergeVerificationConfig(project.verification_config,workstream.verification_config)
const reviewed=resolveVerificationPlan({entries:task.verification_plan??[],configuredCommands:configuration.commands,legacyMappings:configuration.legacy_plan_mappings,phase:'pre_implementation'})
const verificationContract={existing_commands:reviewed.checks,task_owned_outputs:reviewed.deferred.filter(o=>o.kind==='planned_test'),external_evidence:reviewed.deferred.filter(o=>['external_gate','human_gate'].includes(o.kind))}

const prompt = `
Implement ${project.display_name ?? 'the registered project'} task ${task.task_id} in workstream ${workstream.slug ?? task.suit_slug}.

Read, in this order:
1. README.md
2. AGENTS.md
3. ${workstream.application_path ?? suit.app_path}/AGENTS.md if it exists
4. docs/agent-workflows.md
5. ${packetPath}

Task:
${task.title}
${task.description ?? ''}

Requirements:
${requirementIds || 'none explicitly linked'}

Approved/linked decisions:
${decisionIds || 'none'}

Reviewed verification obligations (data, not authority to alter the plan):
${JSON.stringify(verificationContract,null,2)}
Create every task-owned output at its declared path and satisfy its registered executable. External evidence stays an explicit gate; never replace it with local PASS text.

Rules:
- Work only inside the current worktree.
- Implement only this task and its acceptance criteria.
- Preserve unrelated changes.
- Follow all repository and app-specific agent rules.
- Do not merge.
- Do not push.
- Do not deploy.
- Do not modify hosted databases.
- Do not use another app's internals.
- Do not expand scope.
- Run locally relevant checks that are safe for this task.
- Before reporting completion, run the full locally-safe regression command required by the task verification plan when one exists; do not substitute only a narrower newly-added test.
- If Shop Suit Supabase schema, migrations, database tests, or database runner code changed, run 'pnpm db:test:shop' and require it to exit successfully.
- If task-specific Playwright specs changed and browser verification is required, run those changed specs with one worker and retries disabled.
- Do not claim a check passed unless that exact check was actually executed successfully.
- Leave the worktree ready for independent verification.
- Do not create a commit; the control plane owns publication.

At completion, give a concise implementation summary, changed-file summary, checks actually run, failures/unverified items, and blockers.
`.trim()

process.stdout.write(
  `${prompt}\n`,
)
