import { openPullRequests, repository } from './github.mjs'
import { checkPullRequestPolicy } from './policy.mjs'

try {
  const number = Number(process.argv[2])
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Usage: pnpm agent:pr-check <PR number>')
  const errors = checkPullRequestPolicy(openPullRequests(repository()), number)
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log(`PR #${number}: app-specific staging root and same-stack parent chain verified.`)
}
catch (error) {
  console.error(`PR policy check could not complete (${error.code ?? error.status ?? error.name}). Verify GitHub access and the PR number.`)
  process.exitCode = 1
}
