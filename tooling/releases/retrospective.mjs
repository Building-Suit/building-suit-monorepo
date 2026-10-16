import { readFileSync } from 'node:fs'
import { git, plainText } from './fragments.mjs'
import { compareSuitVersions } from '../../packages/contracts/src/changelog.ts'
export const retrospectivePlan = JSON.parse(readFileSync(new URL('./retrospective-shop.json',import.meta.url),'utf8'))
/** Reviewed provider receipts plus actual deployed Git trees, never a commit-to-release inference. */
export function validateRetrospective(plan, main, run=git) {
  if(plan.schemaVersion!==1 || plan.id!=='shop-retrospective-20261016' || plan.suit!=='shop-suit' || plan.numberingOrigin!=='retrospective' || plan.releases.length!==4) throw new Error('Invalid retrospective plan')
  let previousVersion='0.0.0',previousDate=0,previousSha
  for(const row of plan.releases) {
    if(compareSuitVersions(row.version,previousVersion)<=0 || !Number.isFinite(Date.parse(row.releasedAt)) || Date.parse(row.releasedAt)<=previousDate) throw new Error('Invalid retrospective chronology')
    if(row.deployment.branch!=='main' || row.deployment.target!=='production' || row.deployment.state!=='READY' || row.deployment.readyAt!==row.releasedAt
      || !row.deployment.id.startsWith('dpl_') || !row.deployment.url.endsWith('-building-suit.vercel.app')) throw new Error('Missing production deployment receipt')
    run('merge-base','--is-ancestor',row.sourceSha,main)
    if(previousSha) run('merge-base','--is-ancestor',previousSha,row.sourceSha)
    if(run('rev-parse',`${row.sourceSha}^{tree}`)!==row.sourceTree || !row.evidence.length) throw new Error('Historical tree mismatch')
    for(const probe of row.evidence) if(!run('show',`${row.sourceSha}:${probe.path}`).includes(probe.contains)) throw new Error('Missing historical feature evidence')
    for(const field of ['title','summary','details']) for(const locale of ['en','ar']) if(!plainText(row.notes[field][locale])) throw new Error('Invalid retrospective copy')
    if(new Set(Object.values(row.notes).map(value=>value.en)).size!==3 || new Set(Object.values(row.notes).map(value=>value.ar)).size!==3) throw new Error('Duplicate retrospective copy')
    previousVersion=row.version;previousDate=Date.parse(row.releasedAt);previousSha=row.sourceSha
  }
  if(plan.baselineSha!==previousSha || plan.baselineVersion!==previousVersion) throw new Error('Retrospective baseline mismatch')
}
export async function importRetrospective(catalog, request, main, plan=retrospectivePlan) {
  validateRetrospective(plan,main)
  for(const row of plan.releases) {
    const deployment=await request(`deployments/${row.deployment.githubDeploymentId}`)
    if(deployment.sha!==row.sourceSha || deployment.environment!=='Production – shop-suit') throw new Error('Historical deployment binding mismatch')
    const statuses=await request(`deployments/${row.deployment.githubDeploymentId}/statuses?per_page=100`)
    // A later inactivity status is expected when a newer production deployment takes over.
    if(!statuses.some(status=>status.state==='success' && typeof status.environment_url==='string' && new URL(status.environment_url).hostname===row.deployment.url
      && Date.parse(status.created_at)>=Date.parse(row.releasedAt)-1000 && Date.parse(status.created_at)-Date.parse(row.releasedAt)<60000)) throw new Error('Historical deployment success missing')
  }
  return catalog('release_history_import',{p_history:plan})
}
