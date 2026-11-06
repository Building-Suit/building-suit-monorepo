#!/usr/bin/env node
import { isAbsolute } from 'node:path'
import { createSyntheticMeetingRepository } from '../server/meetings/repository.mjs'
import { reviewSyntheticResults } from '../server/meetings/syntheticReviewer.mjs'

const args = process.argv.slice(2)
const index = args.indexOf('--database')
const filename = index >= 0 ? args[index + 1] : undefined
if (!args.includes('--synthetic') || args.includes('--once') === args.includes('--watch') || !filename || !isAbsolute(filename)
  || args.some((arg, i) => !['--synthetic', '--once', '--watch', '--database'].includes(arg) && i !== index + 1)) {
  console.error('Usage: node scripts/meeting-reviewer.mjs --synthetic --once|--watch --database /absolute/disposable-fixture.sqlite')
  process.exitCode = 2
}
else {
  const repository = createSyntheticMeetingRepository({ filename, synthetic: true })
  try {
    if (args.includes('--once')) console.log(JSON.stringify({ reviews: reviewSyntheticResults(repository), synthetic: true }))
    else {
      let stopping = false
      const stop = () => { stopping = true }
      process.once('SIGTERM', stop)
      process.once('SIGINT', stop)
      const stopAt = Date.now() + 30 * 60 * 1000
      while (!stopping && Date.now() < stopAt) {
        const reviews = reviewSyntheticResults(repository)
        if (reviews.length) console.log(JSON.stringify({ reviews, synthetic: true }))
        if (!stopping) await new Promise(resolve => setTimeout(resolve, 500))
      }
      process.removeListener('SIGTERM', stop)
      process.removeListener('SIGINT', stop)
    }
  }
  catch (error) { console.error(error.code ?? 'synthetic-review-failed'); process.exitCode = 1 }
  finally { repository.close() }
}
