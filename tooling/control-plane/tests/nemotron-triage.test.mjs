import assert from 'node:assert/strict'
import test from 'node:test'

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'

import os from 'node:os'
import path from 'node:path'

import {
  appendNemotronTriageHints,
  triageVerificationFailure,
} from '../runner/nemotron-triage.mjs'

test(
  'triage isolates Nemotron from the task worktree',
  () => {
    const root =
      mkdtempSync(
        path.join(
          os.tmpdir(),
          'nemotron-triage-test-',
        ),
      )

    try {
      const logDirectory =
        path.join(
          root,
          'logs',
        )

      mkdirSync(
        logDirectory,
        {
          recursive:
            true,
        },
      )

      const logPath =
        path.join(
          logDirectory,
          'typecheck.log',
        )

      writeFileSync(
        logPath,
        "src/example.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.\n",
      )

      const failurePath =
        path.join(
          root,
          'failure.json',
        )

      writeFileSync(
        failurePath,

        JSON.stringify({
          attempt:
            1,

          verification_failures: [
            {
              check_name:
                'app-typecheck',

              status:
                'fail',

              exit_code:
                2,

              summary:
                'TypeScript failure',

              log_path:
                logPath,
            },
          ],
        }),
      )

      let modelCwd =
        null

      const result =
        triageVerificationFailure({
          taskId:
            'TEST-001',

          worktree:
            root,

          failurePacketPath:
            failurePath,

          runAnalysis:
            ({
              cwd,
              prompt,
              allowRepositoryRead,
            }) => {
              modelCwd =
                cwd

              assert.notEqual(
                path.resolve(cwd),
                path.resolve(root),
              )

              assert.equal(
                existsSync(cwd),
                true,
              )

              assert.deepEqual(
                readdirSync(cwd),
                [],
              )

              assert.equal(
                allowRepositoryRead,
                true,
              )

              assert.match(
                prompt,
                /TS2322/,
              )

              return {
                attempted:
                  true,

                usable:
                  true,

                provider:
                  'opencode',

                model:
                  'test-model',

                analysis: {
                  ok:
                    true,

                  task_id:
                    'TEST-001',

                  failure_class:
                    'type_error',

                  checks: [
                    {
                      check_name:
                        'app-typecheck',

                      assessment:
                        'Type mismatch.',

                      repair_focus:
                        'Correct the assignment type.',

                      needs_full_log:
                        false,
                    },
                  ],

                  repair_sequence: [
                    'Correct the type mismatch.',
                  ],

                  overall_needs_full_log:
                    false,
                },
              }
            },
        })

      assert.equal(
        result.usable,
        true,
      )

      assert.ok(
        modelCwd,
      )

      // Disposable model workspace must be removed after inference.
      assert.equal(
        existsSync(modelCwd),
        false,
      )
    }
    finally {
      rmSync(
        root,
        {
          recursive:
            true,

          force:
            true,
        },
      )
    }
  },
)


test(
  'unusable Nemotron leaves the Codex prompt exactly unchanged',
  () => {
    const original =
      'ORIGINAL CODEX REPAIR PROMPT'

    const result =
      appendNemotronTriageHints(
        original,
        {
          attempted: true,
          usable: false,
          reason: 'nemotron_timeout',
        },
      )

    assert.equal(
      result,
      original,
    )
  },
)

test(
  'usable triage appends non-authoritative repair hints',
  () => {
    const result =
      appendNemotronTriageHints(
        'BASE PROMPT',
        {
          usable: true,

          analysis: {
            failure_class:
              'type-error',

            checks: [
              {
                check_name:
                  'app-typecheck',

                assessment:
                  'Type mismatch.',

                repair_focus:
                  'Correct the assignment.',

                needs_full_log:
                  false,
              },
            ],

            repair_sequence: [
              'Correct the assignment.',
            ],

            overall_needs_full_log:
              false,
          },
        },
      )

    assert.match(
      result,
      /NON-AUTHORITATIVE DIAGNOSTIC HINTS/,
    )

    assert.match(
      result,
      /Type mismatch/,
    )

    assert.match(
      result,
      /remain authoritative/,
    )
  },
)
