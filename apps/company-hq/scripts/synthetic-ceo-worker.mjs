import assert from 'node:assert/strict'
import { existsSync, lstatSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import { load } from './load-test-module.mjs'

// Browser-test fixture only. No provider transport, credentials, HTTP endpoint or runtime hook.
export const syntheticMarker = 'Synthetic CEO end-to-end '
export const syntheticBrainFiles = Object.freeze(Object.fromEntries([
  'AG-CEO-001', 'AG-HR-001', 'AG-HR-002', 'AG-HR-003', 'playbook', 'bootstrap', 'charter',
  'workingAgreement', 'registry', 'organization', 'hrCharter', 'workforceSkill', 'home', 'soul', 'milestones', 'mode',
].map(key => [key, 'synthetic-browser-' + key])))

export function startSyntheticCeoWorker(path) {
  // Only the freshly created disposable browser-server database is permitted.
  const directory = dirname(path)
  assert.equal(dirname(directory), tmpdir())
  assert.match(basename(directory), /^hq-browser-[A-Za-z0-9]+$/)
  assert.equal(path, join(directory, 'hq.sqlite'))
  assert.equal(lstatSync(directory).isSymbolicLink(), false)
  const controller = new AbortController()
  const deadline = setTimeout(() => controller.abort(), 5 * 60_000)
  let dispatcher
  const done = (async () => {
    try {
      while (!existsSync(path)) await delay(100, undefined, { signal: controller.signal })
      assert.equal(lstatSync(path).isSymbolicLink(), false)
      const [{ HqStore }, { HqCeoDispatcher }] = await Promise.all([
        load('../server/utils/hqStore.ts'), load('../server/utils/hqCeoDispatch.ts'),
      ])
      controller.signal.throwIfAborted()
      const store = new HqStore(path)
      const reservations = new Map(), observedContexts = new Set()
      const sequence = [['research', 'AG-HR-002'], ['evaluate', 'AG-HR-003'], ['consolidate', 'AG-HR-001'], ['reply', 'AG-CEO-001']]
      let invocationCount = 0
      dispatcher = new HqCeoDispatcher(store, {
        readiness: { enabled: true, backendScopeVerified: true, modelScopeVerified: true, persistentHostVerified: true, zeroCostHostVerified: true },
        executor: {
          async verify(signal) {
            signal.throwIfAborted()
            return { authenticated: true, zeroIncrementalCost: true, remainingCalls: 4 - reservations.size }
          },
          async reserve(signal) {
            signal.throwIfAborted(); assert.ok(reservations.size < 4)
            const id = 'synthetic-browser-reservation-' + reservations.size
            reservations.set(id, false)
            return { id, zeroIncrementalCost: true }
          },
          async invoke(input, reservationId) {
            input.signal.throwIfAborted()
            assert.equal(reservations.get(reservationId), false)
            reservations.set(reservationId, true)
            assert.deepEqual([input.stage, input.agentId], sequence[invocationCount++])
            assert.equal(observedContexts.has(input.contextId), false); observedContexts.add(input.contextId)
            const assignment = JSON.parse(input.assignment)
            assert.deepEqual(input.publicInputs, [])
            if (input.stage === 'reply') assert.ok(assignment.founderMessage.text.startsWith(syntheticMarker))
            else assert.equal(assignment.founderMessage, undefined)
            const research = input.artifacts.find(artifact => artifact.stage === 'research')
            await delay(50, undefined, { signal: input.signal })
            return {
              identity: { agentId: input.agentId, contextId: input.contextId, principalId: 'synthetic-browser-host-' + input.agentId, isolated: true },
              output: input.stage === 'reply'
                ? 'Synthetic browser verification complete: Noah researched, Iris independently reviewed, Maya consolidated, and Steve answered. No live model or Drive request was made.'
                : 'Synthetic browser ' + input.stage + ' evidence. No live provider was used.',
              sources: [syntheticBrainFiles.playbook],
              ...(input.stage === 'evaluate' ? { review: { accepted: true, artifactDigest: research.digest, evidence: 'Synthetic independent Iris review of the exact Noah artifact.' } } : {}),
            }
          },
        },
        brain: {
          async read(id, { cache, signal }) {
            signal.throwIfAborted(); assert.equal(cache, 'no-store')
            assert.ok(Object.values(syntheticBrainFiles).includes(id))
            return { id, revision: 'synthetic-browser-v1', text: 'Synthetic browser fixture only: ' + id, accessedAt: new Date().toISOString() }
          },
        },
        limits: { stageMs: 10_000, adapterMs: 1000, inferenceMs: 1000, leaseMs: 3000 },
      })
      while (!controller.signal.aborted) {
        const document = store.read()
        const marked = document.tasks.filter(task => task.title.startsWith(syntheticMarker))
        assert.ok(marked.length <= 1, 'Only one marked synthetic task is permitted')
        const task = marked[0]
        if (task?.status === 'queued' && task.approvedAt && task.workflow) {
          assert.ok(task.sourceMessage?.text.startsWith(syntheticMarker))
          assert.deepEqual(task.workflow.brainFiles, syntheticBrainFiles)
          assert.deepEqual(task.workflow.allowedTools, []); assert.deepEqual(task.workflow.publicInputs, [])
          assert.equal(task.workflow.daily, false)
          assert.equal(Object.values(document.workflowRuns || {}).some(run => run.taskId === task.id), false)
          assert.equal(document.tasks.filter(candidate => candidate.sourceMessage && candidate.workflow && candidate.approvedAt && ['queued', 'running', 'review'].includes(candidate.status)).length, 1)
          // Exactly one attempt. A blocked, failed or ambiguous result is never retried.
          const result = await dispatcher.dispatchTask(task.id, controller.signal)
          assert.equal(result.status, 'completed')
          assert.equal(invocationCount, 4); assert.equal(observedContexts.size, 4)
          assert.ok([...reservations.values()].every(Boolean))
          process.stdout.write('[synthetic CEO browser fixture] four roles and durable reply completed; no provider calls\n')
          return
        }
        await delay(100, undefined, { signal: controller.signal })
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error
    } finally {
      clearTimeout(deadline)
      await dispatcher?.close()
    }
  })()
  return { done, async close() { controller.abort(); await done } }
}
