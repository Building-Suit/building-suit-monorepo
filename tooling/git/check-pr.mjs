import { verifySelectivePromotion } from './selective-promotion.mjs'
import { openPullRequests, repository, git } from './github.mjs'
import { checkPullRequestPolicy } from './policy.mjs'

try {
  const number = Number(process.argv[2])
  const extra=process.argv.slice(3)
  if(extra.length && (extra.length!==2 || extra[0]!=='--repository' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(extra[1])))throw new Error('Explicit repository must be owner/name')
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Usage: pnpm agent:pr-check <PR number>')
  const configuredRepository=extra.length?extra[1]:repository()
  const prs = openPullRequests(configuredRepository)
  const current = prs.find(pr => pr.number === number)
  let selectivePromotionVerified = false
  if (current?.base.ref === 'main' && current.head.ref === 'codex/shop-suit/usd-production') {
    const shallow = git(['rev-parse', '--is-shallow-repository']) === 'true'
    git(['fetch', '--no-tags', ...(shallow ? ['--unshallow'] : []), 'origin', 'refs/heads/main:refs/remotes/origin/main', 'refs/heads/stg:refs/remotes/origin/stg'])
    verifySelectivePromotion(current)
    selectivePromotionVerified = true
  }
  const errors = checkPullRequestPolicy(prs, number, { selectivePromotionVerified })
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log(`PR #${number}: app-specific staging root and same-stack parent chain verified.`)
}
catch (error) {
  console.error(`PR policy check could not complete (${error.code ?? error.status ?? error.name}). Verify GitHub access and the PR number.`)
  process.exitCode = 1
}
