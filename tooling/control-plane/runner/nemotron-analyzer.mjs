#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const NEMOTRON_AGENT_ID =
  'automation-suit-nemotron'

export const DEFAULT_NEMOTRON_MODEL =
  process.env.BS_NEMOTRON_MODEL ??
  'opencode/nemotron-3-ultra-free'

const DEFAULT_TIMEOUT_MS =
  Number(
    process.env.BS_NEMOTRON_TIMEOUT_MS ??
    180_000,
  )

const agentSystemPrompt = `
You are the read-only analysis worker for the Building Suit Automation Suit.

Your purpose is to reduce the amount of repository and failure context that
a later implementation agent must consume.

You may inspect repository files and search repository text.

You must never:
- edit, create, move, delete, or patch files;
- execute shell commands;
- run Git, tests, package managers, database tools, or external processes;
- launch subagents;
- use web access;
- access paths outside the current worktree;
- read environment files, credentials, private keys, or secrets;
- mutate control-plane state;
- claim verification passed without explicit supplied evidence.

When JSON is requested:
- return valid JSON only;
- do not wrap it in Markdown;
- do not add prose before or after it;
- do not invent files, requirements, failures, or results;
- use null or empty arrays when evidence is unavailable;
- every repository path referenced must be based on observed evidence.

If evidence is insufficient, report that explicitly instead of guessing.
`.trim()

export function buildOpenCodeConfig(
  model = DEFAULT_NEMOTRON_MODEL,
  {
    allowRepositoryRead = true,
  } = {},
) {
  return {
    agents: {
      [NEMOTRON_AGENT_ID]: {
        description:
          'Read-only Automation Suit context and failure analyzer',

        mode:
          'primary',

        model,

        steps:
          16,

        system:
          agentSystemPrompt,

        permissions: [
          {
            // OpenCode free-tier models require the normal tool surface
            // to remain available. Everything outside the explicit
            // read-only allows below remains approval-gated.
            // Automated control-plane runs never auto-approve requests.
            action: '*',
            resource: '*',
            effect: 'ask',
          },

          ...(
            allowRepositoryRead
              ? [
                  {
                    action: 'read',
                    resource: '*',
                    effect: 'allow',
                  },

                  {
                    action: 'glob',
                    resource: '*',
                    effect: 'allow',
                  },

                  {
                    action: 'grep',
                    resource: '*',
                    effect: 'allow',
                  },
                ]
              : []
          ),

          {
            action: 'external_directory',
            resource: '*',
            effect: 'deny',
          },

          {
            action: 'read',
            resource: '*.env',
            effect: 'deny',
          },

          {
            action: 'read',
            resource: '*.env.*',
            effect: 'deny',
          },

          {
            action: 'read',
            resource: '*.pem',
            effect: 'deny',
          },

          {
            action: 'read',
            resource: '*.key',
            effect: 'deny',
          },

          {
            action: 'read',
            resource: '*.p12',
            effect: 'deny',
          },

          {
            action: 'read',
            resource: '*.pfx',
            effect: 'deny',
          },
        ],
      },
    },
  }
}

export function extractOpenCodeText(
  stdout,
) {
  const textParts = []

  for (
    const line
    of String(stdout ?? '')
      .split('\n')
      .filter(Boolean)
  ) {
    let event

    try {
      event =
        JSON.parse(line)
    }
    catch {
      continue
    }

    if (
      event?.type === 'text' &&
      event?.part?.type === 'text' &&
      typeof event.part.text === 'string'
    ) {
      textParts.push(
        event.part.text,
      )
    }
  }

  return textParts.join('')
}


export function extractOpenCodeJson(
  stdout,
) {
  const textParts = []

  for (
    const line
    of String(stdout ?? '')
      .split('\n')
      .filter(Boolean)
  ) {
    let event

    try {
      event =
        JSON.parse(line)
    }
    catch {
      continue
    }

    if (
      event?.type === 'text' &&
      event?.part?.type === 'text' &&
      typeof event.part.text === 'string'
    ) {
      textParts.push(
        event.part.text,
      )
    }
  }

  function normalizeCandidate(
    value,
  ) {
    let candidate =
      String(value ?? '')
        .trim()

    const fenced =
      candidate.match(
        /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
      )

    if (fenced) {
      candidate =
        fenced[1].trim()
    }

    return candidate
  }

  // Prefer the final assistant response. If the model emitted
  // narration in earlier text parts, progressively ignore those
  // earlier parts while preserving support for a final JSON response
  // split across more than one text event.
  for (
    let start =
      textParts.length - 1;
    start >= 0;
    start--
  ) {
    const candidate =
      normalizeCandidate(
        textParts
          .slice(start)
          .join(''),
      )

    try {
      return {
        value:
          JSON.parse(
            candidate,
          ),

        response_text:
          candidate,
      }
    }
    catch {
      // Try the next suffix.
    }
  }

  return {
    value:
      null,

    response_text:
      textParts.join(''),
  }
}

function unavailable({
  reason,
  model,
  elapsedMs,
  exitCode = null,
  errorCode = null,
  stdout = '',
  stderr = '',
  responseText = '',
}) {
  return {
    attempted: true,
    usable: false,

    provider:
      'opencode',

    model,

    agent:
      NEMOTRON_AGENT_ID,

    reason,

    analysis:
      null,

    telemetry: {
      elapsed_ms:
        elapsedMs,

      exit_code:
        exitCode,

      error_code:
        errorCode,

      partial_stdout_tail:
        String(stdout ?? '')
          .slice(-4000),

      stderr_tail:
        String(stderr ?? '')
          .slice(-4000),

      response_text_tail:
        String(responseText ?? '')
          .slice(-4000),
    },
  }
}

export function runNemotronAnalysis({
  cwd,
  prompt,
  model = DEFAULT_NEMOTRON_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  binary =
    process.env.BS_OPENCODE_BIN ??
    'opencode',
  spawnImpl = spawnSync,
  allowRepositoryRead = true,
}) {
  const startedAt =
    Date.now()

  const resolvedCwd =
    path.resolve(
      String(cwd ?? ''),
    )

  if (
    !cwd ||
    !existsSync(resolvedCwd)
  ) {
    return unavailable({
      reason:
        'analysis_worktree_unavailable',

      model,

      elapsedMs:
        Date.now() - startedAt,
    })
  }

  if (
    typeof prompt !== 'string' ||
    !prompt.trim()
  ) {
    return unavailable({
      reason:
        'analysis_prompt_missing',

      model,

      elapsedMs:
        Date.now() - startedAt,
    })
  }

  const config =
    JSON.stringify(
      buildOpenCodeConfig(
        model,
        {
          allowRepositoryRead,
        },
      ),
    )

  const result =
    spawnImpl(
      binary,

      [
        'run',
        '--standalone',

        '--agent',
        NEMOTRON_AGENT_ID,

        '--model',
        model,

        '--format',
        'json',

        prompt,
      ],

      {
        cwd:
          resolvedCwd,

        encoding:
          'utf8',

        timeout:
          timeoutMs,

        maxBuffer:
          50 * 1024 * 1024,

        env: {
          ...process.env,

          NO_COLOR:
            '1',

          FORCE_COLOR:
            '0',

          OPENCODE_DISABLE_AUTOUPDATE:
            '1',

          // Runtime config has higher precedence than project config.
          // This keeps analyzer permissions under control-plane ownership
          // even when inspecting another registered repository.
          OPENCODE_CONFIG_CONTENT:
            config,
        },
      },
    )

  const elapsedMs =
    Date.now() - startedAt

  if (result?.error) {
    const code =
      result.error.code ??
      null

    if (
      code === 'ENOENT'
    ) {
      return unavailable({
        reason:
          'opencode_not_available',

        model,
        elapsedMs,

        errorCode:
          code,

        stdout:
          result.stdout,

        stderr:
          result.stderr,
      })
    }

    if (
      code === 'ETIMEDOUT'
    ) {
      return unavailable({
        reason:
          'nemotron_timeout',

        model,
        elapsedMs,

        errorCode:
          code,

        stdout:
          result.stdout,

        stderr:
          result.stderr,
      })
    }

    return unavailable({
      reason:
        'opencode_execution_error',

      model,
      elapsedMs,

      errorCode:
        code,
    })
  }

  const exitCode =
    typeof result?.status === 'number'
      ? result.status
      : 1

  if (
    exitCode !== 0
  ) {
    return unavailable({
      reason:
        'nemotron_nonzero_exit',

      model,
      elapsedMs,
      exitCode,
    })
  }

  const extracted =
    extractOpenCodeJson(
      result.stdout,
    )

  const responseText =
    extracted.response_text

  if (!responseText.trim()) {
    return unavailable({
      reason:
        'nemotron_no_response',

      model,
      elapsedMs,
      exitCode,

      stdout:
        result.stdout,

      stderr:
        result.stderr,
    })
  }

  const analysis =
    extracted.value

  if (!analysis) {
    return unavailable({
      reason:
        'nemotron_invalid_json',

      model,
      elapsedMs,
      exitCode,

      stdout:
        result.stdout,

      stderr:
        result.stderr,

      responseText,
    })
  }

  return {
    attempted: true,
    usable: true,

    provider:
      'opencode',

    model,

    agent:
      NEMOTRON_AGENT_ID,

    reason:
      null,

    analysis,

    telemetry: {
      elapsed_ms:
        elapsedMs,

      exit_code:
        exitCode,

      error_code:
        null,

      stdout_bytes:
        Buffer.byteLength(
          String(result.stdout ?? ''),
          'utf8',
        ),
    },
  }
}

export function validateProbeResult(
  result,
) {
  if (!result.usable) {
    return result
  }

  const analysis =
    result.analysis

  const valid =
    analysis?.ok === true &&
    Array.isArray(
      analysis.files_observed,
    ) &&
    analysis.files_observed.includes(
      'README.md',
    ) &&
    typeof analysis.summary ===
      'string' &&
    analysis.summary.length > 0

  if (valid) {
    return result
  }

  return {
    ...result,

    usable:
      false,

    reason:
      'nemotron_probe_schema_invalid',

    analysis:
      null,
  }
}

function probePrompt() {
  return `
Inspect README.md in the current repository.

Return JSON only with exactly these fields:

{
  "ok": true,
  "files_observed": ["README.md"],
  "summary": "one concise sentence describing the repository"
}

Requirements:
- Actually inspect README.md.
- Do not modify anything.
- Do not execute shell commands.
- Do not use the web.
- Do not invent repository facts.
`.trim()
}

function main() {
  const [
    command,
    cwd = '.',
  ] =
    process.argv.slice(2)

  if (
    command !== 'probe'
  ) {
    process.stderr.write(
      'Usage: nemotron-analyzer.mjs probe [worktree]\n',
    )

    process.exitCode =
      64

    return
  }

  const result =
    validateProbeResult(
      runNemotronAnalysis({
        cwd,
        prompt:
          probePrompt(),
      }),
    )

  process.stdout.write(
    `${JSON.stringify(
      result,
      null,
      2,
    )}\n`,
  )

  process.exitCode =
    result.usable
      ? 0
      : 2
}

const modulePath =
  fileURLToPath(
    import.meta.url,
  )

const invokedPath =
  process.argv[1]
    ? path.resolve(
        process.argv[1],
      )
    : ''

if (
  invokedPath === modulePath
) {
  main()
}
