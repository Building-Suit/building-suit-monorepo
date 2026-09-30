import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NEMOTRON_AGENT_ID,
  buildOpenCodeConfig,
  extractOpenCodeText,
  runNemotronAnalysis,
  validateProbeResult,
} from '../runner/nemotron-analyzer.mjs'

function textEvent(text) {
  return JSON.stringify({
    type: 'text',

    part: {
      type: 'text',
      text,
    },
  })
}

test(
  'analyzer policy permits discovery only',
  () => {
    const config =
      buildOpenCodeConfig(
        'example/model',
      )

    const agent =
      config.agents[
        NEMOTRON_AGENT_ID
      ]

    assert.equal(
      agent.model,
      'example/model',
    )

    assert.deepEqual(
      agent.permissions.slice(
        0,
        4,
      ),

      [
        {
          action: '*',
          resource: '*',
          effect: 'ask',
        },

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
      ],
    )

    assert.ok(
      agent.permissions.some(
        rule =>
          rule.action ===
            'external_directory' &&
          rule.effect === 'deny',
      ),
    )

    assert.ok(
      agent.permissions.some(
        rule =>
          rule.action === 'read' &&
          rule.resource === '*.env' &&
          rule.effect === 'deny',
      ),
    )
  },
)

test(
  'extracts assistant text from OpenCode JSONL',
  () => {
    const stdout =
      [
        JSON.stringify({
          type:
            'step_start',
        }),

        textEvent(
          '{"ok":true}',
        ),
      ].join('\n')

    assert.equal(
      extractOpenCodeText(
        stdout,
      ),

      '{"ok":true}',
    )
  },
)

test(
  'valid Nemotron output is usable',
  () => {
    const fakeSpawn =
      (
        _binary,
        _args,
        options,
      ) => {
        const config =
          JSON.parse(
            options.env
              .OPENCODE_CONFIG_CONTENT,
          )

        assert.ok(
          config.agents[
            NEMOTRON_AGENT_ID
          ],
        )

        return {
          status:
            0,

          stdout:
            textEvent(
              JSON.stringify({
                ok:
                  true,

                files_observed:
                  ['README.md'],

                summary:
                  'Repository summary.',
              }),
            ),

          stderr:
            '',
        }
      }

    const result =
      validateProbeResult(
        runNemotronAnalysis({
          cwd:
            process.cwd(),

          prompt:
            'test',

          spawnImpl:
            fakeSpawn,
        }),
      )

    assert.equal(
      result.usable,
      true,
    )

    assert.equal(
      result.analysis.ok,
      true,
    )
  },
)

test(
  'invalid model JSON becomes fallback instead of throwing',
  () => {
    const result =
      runNemotronAnalysis({
        cwd:
          process.cwd(),

        prompt:
          'test',

        spawnImpl:
          () => ({
            status:
              0,

            stdout:
              textEvent(
                'not-json',
              ),

            stderr:
              '',
          }),
      })

    assert.equal(
      result.usable,
      false,
    )

    assert.equal(
      result.reason,
      'nemotron_invalid_json',
    )
  },
)

test(
  'missing OpenCode becomes fallback',
  () => {
    const error =
      new Error(
        'not found',
      )

    error.code =
      'ENOENT'

    const result =
      runNemotronAnalysis({
        cwd:
          process.cwd(),

        prompt:
          'test',

        spawnImpl:
          () => ({
            status:
              null,

            stdout:
              '',

            stderr:
              '',

            error,
          }),
      })

    assert.equal(
      result.usable,
      false,
    )

    assert.equal(
      result.reason,
      'opencode_not_available',
    )
  },
)

test(
  'timeout becomes fallback',
  () => {
    const error =
      new Error(
        'timed out',
      )

    error.code =
      'ETIMEDOUT'

    const result =
      runNemotronAnalysis({
        cwd:
          process.cwd(),

        prompt:
          'test',

        spawnImpl:
          () => ({
            status:
              null,

            stdout:
              '',

            stderr:
              '',

            error,
          }),
      })

    assert.equal(
      result.usable,
      false,
    )

    assert.equal(
      result.reason,
      'nemotron_timeout',
    )
  },
)

test(
  'nonzero OpenCode exit becomes fallback',
  () => {
    const result =
      runNemotronAnalysis({
        cwd:
          process.cwd(),

        prompt:
          'test',

        spawnImpl:
          () => ({
            status:
              1,

            stdout:
              '',

            stderr:
              'provider unavailable',
          }),
      })

    assert.equal(
      result.usable,
      false,
    )

    assert.equal(
      result.reason,
      'nemotron_nonzero_exit',
    )
  },
)

test(
  'uses final JSON text when earlier assistant text is narration',
  () => {
    const result =
      runNemotronAnalysis({
        cwd:
          process.cwd(),

        prompt:
          'test',

        spawnImpl:
          () => ({
            status:
              0,

            stdout:
              [
                textEvent(
                  'Inspecting relevant files.',
                ),

                textEvent(
                  JSON.stringify({
                    ok:
                      true,

                    files_observed:
                      ['README.md'],

                    summary:
                      'Repository summary.',
                  }),
                ),
              ].join('\n'),

            stderr:
              '',
          }),
      })

    assert.equal(
      result.usable,
      true,
    )

    assert.equal(
      result.analysis.ok,
      true,
    )
  },
)

test(
  'tool-free mode leaves repository tools approval-gated',
  () => {
    const config =
      buildOpenCodeConfig(
        'example/model',
        {
          allowRepositoryRead:
            false,
        },
      )

    const permissions =
      config.agents[
        NEMOTRON_AGENT_ID
      ].permissions

    assert.equal(
      permissions.some(
        rule =>
          ['read', 'glob', 'grep']
            .includes(rule.action) &&
          rule.effect === 'allow',
      ),
      false,
    )

    assert.deepEqual(
      permissions[0],
      {
        action: '*',
        resource: '*',
        effect: 'ask',
      },
    )
  },
)
