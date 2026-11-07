#!/usr/bin/env node
import { isAbsolute } from 'node:path'
import { createSyntheticMeetingRepository } from '../server/meetings/repository.mjs'
import { createMeetingWorker, createSyntheticExecutor } from '../server/meetings/worker.mjs'

const args = process.argv.slice(2)
const index = args.indexOf('--database')
const filename = index >= 0 ? args[index + 1] : undefined
if (!args.includes('--synthetic') || args.includes('--once') === args.includes('--watch') || !filename || !isAbsolute(filename)
  || args.some((arg, i) => !['--synthetic', '--once', '--watch', '--database'].includes(arg) && i !== index + 1)) {
  console.error('Usage: node scripts/meeting-worker.mjs --synthetic --once|--watch --database /absolute/disposable-fixture.sqlite')
  process.exitCode = 2
}
else {
  const repository = createSyntheticMeetingRepository({ filename, synthetic: true })
  try {
    const worker = createMeetingWorker({ repository, executor: createSyntheticExecutor() })
    if (args.includes('--once')) console.log(JSON.stringify(await worker.runOnce()))
    else {
      let stopping = false
      const stop = () => { stopping = true }
      process.once('SIGTERM', stop)
      process.once('SIGINT', stop)
      // Bounded disposable preview service; no browser heartbeat owns its life.
      const stopAt = Date.now() + 30 * 60 * 1000
      while (!stopping && Date.now() < stopAt) {
        const result = await worker.runOnce()
        if (result.claimed) console.log(JSON.stringify(result))
        if (!stopping) await new Promise(resolve => setTimeout(resolve, 500))
      }
      process.removeListener('SIGTERM', stop)
      process.removeListener('SIGINT', stop)
    }
  }
  catch (error) { console.error(error.code ?? 'synthetic-worker-failed'); process.exitCode = 1 }
  finally { repository.close() }
}
