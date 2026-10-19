import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {retrospectivePlan,validateRetrospective,importRetrospective} from './retrospective.mjs'
import {isChangelogNew,parseChangelogFeed} from '../../packages/contracts/src/changelog.ts'
const clone=()=>structuredClone(retrospectivePlan)
test('four retrospective milestones have increasing real deployment dates, deployed main trees and distinct bilingual copy',()=>{
  validateRetrospective(retrospectivePlan,'origin/main')
  assert.equal(retrospectivePlan.baselineVersion,'0.4.0')
  assert.equal(retrospectivePlan.releases.at(-1).releasedAt,'2026-10-14T11:29:16.099Z')
  const sql=readFileSync(new URL('../../apps/super-admin-suit/supabase/migrations/20261016175503_retrospective_shop_history.sql',import.meta.url),'utf8')
  const sealed=sql.match(/as \$plan\$ select '([\s\S]*?)'::jsonb \$plan\$/)[1].replaceAll("''","'")
  assert.deepEqual(JSON.parse(sealed),retrospectivePlan,'The service importer accepts exactly the reviewed repository plan')
})
test('retrospective provenance refuses staging deployments, changed trees, missing code, dates and numbering drift',()=>{
  for(const mutate of [p=>p.releases[0].deployment.branch='stg',p=>p.releases[0].sourceTree='0'.repeat(40),p=>p.releases[0].evidence[0].contains='nonexistent-history-proof',p=>p.releases[1].releasedAt=p.releases[0].releasedAt,p=>p.baselineVersion='1.0.0']){
    const p=clone();mutate(p);assert.throws(()=>validateRetrospective(p,'origin/main'))
  }
})
test('publisher imports only after all exact deployed-main GitHub bindings and success statuses pass',async()=>{
  const imports=[]
  const request=async path=>{
    const row=retrospectivePlan.releases.find(r=>path.startsWith(`deployments/${r.deployment.githubDeploymentId}`))
    return path.includes('/statuses')?[{state:'inactive'},{state:'success',environment_url:`https://${row.deployment.url}`,created_at:row.releasedAt}]:{sha:row.sourceSha,environment:'Production – shop-suit'}
  }
  await importRetrospective(async(...args)=>imports.push(args),request,'origin/main')
  assert.equal(imports.length,1);assert.equal(imports[0][0],'release_history_import')
  await assert.rejects(importRetrospective(async()=>assert.fail('must not import'),async path=>path.includes('/statuses')?[]:request(path),'origin/main'),/success missing/)
  await assert.rejects(importRetrospective(async()=>assert.fail('must not import'),async()=>({sha:'0'.repeat(40),environment:'Production – shop-suit'}),'origin/main'),/binding mismatch/)
})
test('retrospective records preserve true import time and deployment date without claiming New or weakening normal release requirements',()=>{
  const row=retrospectivePlan.releases[0]
  const entry={id:'history',suit:'shop-suit',visibility:'public',status:'released',version:row.version,versionOrigin:'retrospective',releasedAt:row.releasedAt,publishedAt:'2026-10-16T18:00:00Z',...row.notes,links:[]}
  const feed={serverNow:entry.publishedAt,suits:[{id:'shop-suit',name:{en:'Shop',ar:'المتجر'}}],entries:[entry]}
  assert.equal(parseChangelogFeed(feed).entries[0].versionOrigin,'retrospective')
  assert.equal(isChangelogNew(entry,feed.serverNow),false)
  assert.equal(isChangelogNew({...entry,versionOrigin:undefined},feed.serverNow),true)
  assert.throws(()=>parseChangelogFeed({...feed,entries:[{...entry,version:undefined}]}))
  assert.throws(()=>parseChangelogFeed({...feed,entries:[{...entry,versionOrigin:'original-tag'}]}))
})
