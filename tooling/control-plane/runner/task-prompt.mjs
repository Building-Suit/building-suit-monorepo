#!/usr/bin/env node

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

const requirementIds =
  (packet.requirements ?? [])
    .map(item => item.id)
    .join(', ')

const decisionIds =
  (packet.decisions ?? [])
    .map(item => item.id)
    .join(', ')

const prompt = `
Implement Building Suit task ${task.task_id}.

Read, in this order:
1. README.md
2. AGENTS.md
3. ${suit.app_path}/AGENTS.md if it exists
4. docs/agent-workflows.md
5. ${packetPath}

Task:
${task.title}

Requirements:
${requirementIds || 'none explicitly linked'}

Approved/linked decisions:
${decisionIds || 'none'}

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
- Leave the worktree ready for independent verification.
- Do not create a commit; the control plane owns publication.

At completion, give a concise implementation summary, changed-file summary, checks actually run, failures/unverified items, and blockers.
`.trim()

process.stdout.write(
  `${prompt}\n`,
)
