#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  fstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
} from 'node:fs'

import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  redactText,
} from '../lib/redaction.mjs'

import {
  runNemotronAnalysis,
} from './nemotron-analyzer.mjs'

const DEFAULT_TRIAGE_TIMEOUT_MS =
  Number(
    process.env.BS_NEMOTRON_TRIAGE_TIMEOUT_MS ??
    30_000,
  )

const MAX_LOG_BYTES_PER_CHECK =
  12_000

const MAX_TOTAL_LOG_BYTES =
  32_000

function safePathWithin(
  root,
  value,
) {
  if (
    typeof value !== 'string' ||
    !value
  ) {
    return null
  }

  const resolvedRoot =
    path.resolve(root)

  const resolved =
    path.isAbsolute(value)
      ? path.resolve(value)
      : path.resolve(
          resolvedRoot,
          value,
        )

  const relative =
    path.relative(
      resolvedRoot,
      resolved,
    )

  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    return null
  }

  return existsSync(resolved)
    ? resolved
    : null
}

function readSegment(
  fd,
  position,
  length,
) {
  const buffer =
    Buffer.alloc(length)

  const bytes =
    readSync(
      fd,
      buffer,
      0,
      length,
      position,
    )

  return buffer
    .subarray(
      0,
      bytes,
    )
    .toString('utf8')
}

export function readBoundedLog(
  filePath,
  maxBytes =
    MAX_LOG_BYTES_PER_CHECK,
) {
  const fd =
    openSync(
      filePath,
      'r',
    )

  try {
    const size =
      fstatSync(fd).size

    if (size <= maxBytes) {
      return {
        text:
          readSegment(
            fd,
            0,
            size,
          ),

        truncated:
          false,
      }
    }

    const headBytes =
      Math.floor(
        maxBytes / 3,
      )

    const tailBytes =
      maxBytes - headBytes

    const head =
      readSegment(
        fd,
        0,
        headBytes,
      )

    const tail =
      readSegment(
        fd,
        Math.max(
          0,
          size - tailBytes,
        ),
        tailBytes,
      )

    return {
      text:
        [
          head,

          '\n\n[... log excerpt truncated ...]\n\n',

          tail,
        ].join(''),

      truncated:
        true,
    }
  }
  finally {
    closeSync(fd)
  }
}

export function buildTriageEvidence({
  taskId,
  worktree,
  failurePacket,
}) {
  const failures =
    Array.isArray(
      failurePacket
        ?.verification_failures,
    )
      ? failurePacket
          .verification_failures
      : []

  let remainingBytes =
    MAX_TOTAL_LOG_BYTES

  const failedChecks =
    failures.map(
      (failure) => {
        let logExcerpt =
          ''

        let logTruncated =
          false

        if (
          remainingBytes > 0 &&
          failure?.log_path
        ) {
          const logPath =
            safePathWithin(
              worktree,
              failure.log_path,
            )

          if (logPath) {
            const bounded =
              readBoundedLog(
                logPath,
                Math.min(
                  MAX_LOG_BYTES_PER_CHECK,
                  remainingBytes,
                ),
              )

            logExcerpt =
              redactText(
                bounded.text,
              )

            logTruncated =
              bounded.truncated

            remainingBytes -=
              Buffer.byteLength(
                logExcerpt,
                'utf8',
              )
          }
        }

        return {
          check_name:
            String(
              failure?.check_name ??
              '',
            ),

          status:
            String(
              failure?.status ??
              '',
            ),

          exit_code:
            failure?.exit_code ??
            null,

          summary:
            redactText(
              String(
                failure?.summary ??
                '',
              ),
            ).slice(
              0,
              4000,
            ),

          log_excerpt:
            logExcerpt,

          log_excerpt_truncated:
            logTruncated,
        }
      },
    )

  return {
    task_id:
      taskId,

    previous_attempt:
      failurePacket?.attempt ??
      null,

    failed_checks:
      failedChecks,
  }
}

function triagePrompt(
  evidence,
) {
  return `
You are doing bounded verification-failure triage for an Automation Suit task.

Do not use tools.
Do not inspect repository files.
Do not execute commands.
Do not access the web.

Use only the evidence embedded below.

Evidence:
${JSON.stringify(evidence, null, 2)}

Return JSON only with exactly this top-level structure:

{
  "ok": true,
  "task_id": "${evidence.task_id}",
  "failure_class": "",
  "checks": [
    {
      "check_name": "",
      "assessment": "",
      "repair_focus": "",
      "needs_full_log": false
    }
  ],
  "repair_sequence": [],
  "overall_needs_full_log": false
}

Rules:
- Include every failed check exactly once.
- check_name must exactly match the supplied evidence.
- Do not invent additional checks.
- Base assessment and repair_focus only on supplied evidence.
- Keep repair guidance concise.
- If an excerpt is insufficient, set needs_full_log=true instead of guessing.
- overall_needs_full_log must be true if any individual check needs the full log.
- Do not claim that any repair has been performed.
- Do not claim verification passed.
`.trim()
}

function stringArray(
  value,
) {
  return (
    Array.isArray(value) &&
    value.every(
      item =>
        typeof item ===
          'string' &&
        item.trim()
          .length > 0,
    )
  )
}

export function validateTriage({
  taskId,
  evidence,
  analysis,
}) {
  const errors = []

  if (
    analysis?.ok !== true
  ) {
    errors.push(
      'analysis_ok_required',
    )
  }

  if (
    analysis?.task_id !==
    taskId
  ) {
    errors.push(
      'task_id_mismatch',
    )
  }

  if (
    typeof analysis
      ?.failure_class !==
      'string' ||
    !analysis
      .failure_class
      .trim()
  ) {
    errors.push(
      'failure_class_required',
    )
  }

  if (
    !Array.isArray(
      analysis?.checks,
    )
  ) {
    errors.push(
      'checks_required',
    )
  }
  else {
    const expected =
      evidence.failed_checks
        .map(
          item =>
            item.check_name,
        )
        .sort()

    const actual =
      analysis.checks
        .map(
          item =>
            item?.check_name,
        )
        .sort()

    if (
      JSON.stringify(
        actual,
      ) !==
      JSON.stringify(
        expected,
      )
    ) {
      errors.push(
        'check_coverage_mismatch',
      )
    }

    for (
      const check
      of analysis.checks
    ) {
      if (
        typeof check
          ?.assessment !==
          'string' ||
        !check
          .assessment
          .trim()
      ) {
        errors.push(
          `assessment_required:${check?.check_name ?? 'unknown'}`,
        )
      }

      if (
        typeof check
          ?.repair_focus !==
          'string' ||
        !check
          .repair_focus
          .trim()
      ) {
        errors.push(
          `repair_focus_required:${check?.check_name ?? 'unknown'}`,
        )
      }

      if (
        typeof check
          ?.needs_full_log !==
          'boolean'
      ) {
        errors.push(
          `needs_full_log_required:${check?.check_name ?? 'unknown'}`,
        )
      }
    }
  }

  if (
    !stringArray(
      analysis?.repair_sequence,
    )
  ) {
    errors.push(
      'repair_sequence_required',
    )
  }

  if (
    typeof analysis
      ?.overall_needs_full_log !==
      'boolean'
  ) {
    errors.push(
      'overall_needs_full_log_required',
    )
  }

  return {
    valid:
      errors.length === 0,

    errors,
  }
}

export function triageVerificationFailure({
  taskId,
  worktree,
  failurePacketPath,
  timeoutMs =
    DEFAULT_TRIAGE_TIMEOUT_MS,
  runAnalysis =
    runNemotronAnalysis,
}) {
  const root =
    path.resolve(
      worktree,
    )

  const resolvedFailurePacket =
    safePathWithin(
      root,
      failurePacketPath,
    )

  if (
    !resolvedFailurePacket
  ) {
    return {
      attempted:
        false,

      usable:
        false,

      reason:
        'failure_packet_unavailable',

      analysis:
        null,
    }
  }

  let failurePacket

  try {
    failurePacket =
      JSON.parse(
        readFileSync(
          resolvedFailurePacket,
          'utf8',
        ),
      )
  }
  catch {
    return {
      attempted:
        false,

      usable:
        false,

      reason:
        'failure_packet_invalid',

      analysis:
        null,
    }
  }

  if (
    !Array.isArray(
      failurePacket
        ?.verification_failures,
    ) ||
    failurePacket
      .verification_failures
      .length === 0
  ) {
    return {
      attempted:
        false,

      usable:
        false,

      reason:
        'no_verification_failures',

      analysis:
        null,
    }
  }

  const evidence =
    buildTriageEvidence({
      taskId,
      worktree:
        root,
      failurePacket,
    })

  // Nemotron receives only deterministically collected evidence.
  // Run it from a disposable empty directory so the real task
  // worktree is not exposed to repository tools.
  const analysisDirectory =
    mkdtempSync(
      path.join(
        os.tmpdir(),
        'building-suit-nemotron-triage-',
      ),
    )

  let result

  try {
    result =
      runAnalysis({
        cwd:
          analysisDirectory,

        prompt:
          triagePrompt(
            evidence,
          ),

        timeoutMs,

        // OpenCode free-tier models require the read-tool surface
        // to remain available. The disposable cwd provides the
        // repository boundary instead.
        allowRepositoryRead:
          true,
      })
  }
  finally {
    rmSync(
      analysisDirectory,
      {
        recursive:
          true,

        force:
          true,
      },
    )
  }

  if (!result.usable) {
    return result
  }

  const validation =
    validateTriage({
      taskId,
      evidence,
      analysis:
        result.analysis,
    })

  if (
    !validation.valid
  ) {
    return {
      ...result,

      usable:
        false,

      reason:
        'nemotron_triage_invalid',

      analysis:
        null,

      validation,
    }
  }

  return {
    ...result,

    task_id:
      taskId,

    validation,

    evidence: {
      failed_check_count:
        evidence
          .failed_checks
          .length,

      supplied_log_excerpt_bytes:
        evidence
          .failed_checks
          .reduce(
            (
              total,
              check,
            ) =>
              total +
              Buffer.byteLength(
                check
                  .log_excerpt,
                'utf8',
              ),

            0,
          ),
    },
  }
}


export function appendNemotronTriageHints(
  prompt,
  triageResult,
) {
  if (
    triageResult?.usable !== true ||
    !triageResult.analysis
  ) {
    // Critical fallback invariant:
    // Nemotron failure must not alter the existing Codex prompt.
    return prompt
  }

  const analysis =
    triageResult.analysis

  const hints = {
    failure_class:
      analysis.failure_class,

    checks:
      analysis.checks,

    repair_sequence:
      analysis.repair_sequence,

    overall_needs_full_log:
      analysis.overall_needs_full_log,
  }

  return `${prompt}

Nemotron bounded verification triage — NON-AUTHORITATIVE DIAGNOSTIC HINTS:

${JSON.stringify(hints, null, 2)}

Rules for these hints:
- The task packet, AGENTS instructions, verifier evidence, logs and actual repository state remain authoritative.
- These hints must never override task requirements, approved decisions or verifier evidence.
- If a hint conflicts with authoritative evidence, ignore the hint.
- Start diagnosis from these hints before opening full verifier logs.
- When overall_needs_full_log is false, avoid reading full logs unless the repair cannot be established safely from the supplied evidence.
- Nemotron has not edited files, run checks or verified the repair.
`.trim()
}

function main() {
  const [
    command,
    taskId,
    worktree,
    failurePacketPath,
  ] =
    process.argv.slice(2)

  if (
    command !== 'triage' ||
    !taskId ||
    !worktree ||
    !failurePacketPath
  ) {
    process.stderr.write(
      'Usage: nemotron-triage.mjs triage <task-id> <worktree> <failure-packet>\n',
    )

    process.exitCode =
      64

    return
  }

  const result =
    triageVerificationFailure({
      taskId,
      worktree,
      failurePacketPath,
    })

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
