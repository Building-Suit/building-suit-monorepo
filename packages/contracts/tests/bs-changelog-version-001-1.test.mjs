import test from 'node:test'
import assert from 'node:assert/strict'
import { parseChangelogFeed, filterChangelog, isChangelogNew, isSuitVersion, CHANGELOG_NEW_WINDOW_MS } from '../src/changelog.ts'
import { createChangelogClient } from '../../data-access/src/changelog.ts'
const bilingual = { en: 'Workspace update', ar: 'تحديث مساحة العمل' }
const entry = { id: 'release', suit: 'shop-suit', visibility: 'public', publishedAt: '2026-10-09T12:00:00Z', releasedAt: '2026-10-09T10:00:00Z', status: 'released', version: '1.0.0', title: bilingual, summary: bilingual, details: bilingual, links: [] }
const fixture = (changes = {}) => ({ serverNow: '2026-10-10T12:00:00Z', suits: ['shop','ledger','inventory','automation','future'].map(id => ({ id: `${id}-suit`, name: bilingual })), entries: [entry], ...changes })
test('semantic versions include explicit prerelease/build labels and reject malformed numeric identifiers', () => {
  for (const value of ['0.0.0','1.2.3','2.0.0-beta.1','1.0.0-0','1.2.3+build.001']) assert.ok(isSuitVersion(value), value)
  for (const value of ['v1.0.0','1.2','01.0.0','1.0.0-01','1.0.0-','1.0.0-alpha..1',null]) assert.equal(isSuitVersion(value),false,String(value))
})
test('released version, bilingual content, identity, visibility, status and UTC timestamps are required', () => {
  assert.deepEqual(parseChangelogFeed(fixture()).entries[0],entry)
  for (const change of [{version:undefined},{status:'draft'},{suit:'unknown-suit'},{visibility:'secret'},{title:{en:'Only English'}},{details:{en:'',ar:'نص'}},{publishedAt:'2026-02-30T12:00:00Z'},{releasedAt:'2026-10-11T12:00:00Z'},{publishedAt:'2026-10-09'},{targetVersion:'2.0.0'}]) assert.throws(() => parseChangelogFeed(fixture({entries:[{...entry,...change}]})))
  assert.throws(() => parseChangelogFeed(fixture({ serverNow: 'bad' })))
  assert.throws(() => parseChangelogFeed(fixture({ entries: [entry,entry] })))
  assert.throws(() => parseChangelogFeed(fixture({ suits: [{id:'shop-suit', name:bilingual},{id:'shop-suit', name:bilingual}] })))
})
test('Coming Soon uses a target semver and never masquerades as a release or New', () => {
  const upcoming = {...entry,status:'coming-soon',targetVersion:'1.1.0-beta.1'}
  delete upcoming.version
  delete upcoming.releasedAt
  assert.equal(parseChangelogFeed(fixture({entries:[upcoming]})).entries[0].targetVersion,'1.1.0-beta.1')
  assert.equal(isChangelogNew(upcoming,'2026-10-10T12:00:00Z'),false)
  for (const change of [{targetVersion:undefined},{version:'1.1.0'},{releasedAt:entry.releasedAt}]) assert.throws(() => parseChangelogFeed(fixture({entries:[{...upcoming,...change}]})))
})
test('New lasts exactly 48 hours from publication, independent of release time and browser clock', () => {
  assert.equal(CHANGELOG_NEW_WINDOW_MS,172800000)
  assert.equal(isChangelogNew(entry,'2026-10-09T11:59:59Z'),false)
  assert.equal(isChangelogNew(entry,entry.publishedAt),true)
  assert.equal(isChangelogNew(entry,'2026-10-11T11:59:59.999Z'),true)
  assert.equal(isChangelogNew(entry,'2026-10-11T12:00:00Z'),false)
  assert.throws(() => isChangelogNew(entry,'invalid'))
})
test('public filtering supports every registered Suit, locale, status, search and deterministic publication order', () => {
  const entries = fixture().suits.map((suit,i) => ({...entry,id:`entry-${i}`,suit:suit.id}))
  const feed = parseChangelogFeed(fixture({entries:[...entries,{...entry,id:'internal',visibility:'internal'},{...entry,id:'future-publication',publishedAt:'2026-10-12T12:00:00Z'}]}))
  assert.equal(filterChangelog(feed).length,5)
  for (const suit of feed.suits) assert.equal(filterChangelog(feed,{suit:suit.id,status:'released'}).length,1)
  assert.equal(filterChangelog(feed,{status:'coming-soon'}).length,0)
  assert.equal(filterChangelog(feed,{locale:'ar',search:'مساحة'}).length,5)
  assert.equal(filterChangelog(feed,{search:'nonexistent'}).length,0)
  const earlier = {...entry,id:'earlier',publishedAt:'2026-10-08T12:00:00Z',releasedAt:'2026-10-08T10:00:00Z'}
  assert.equal(filterChangelog(parseChangelogFeed(fixture({entries:[earlier,entry]})))[0].id,'release')
})
test('safe content projection strips backend metadata and validates links without rendering raw HTML', () => {
  const feed = parseChangelogFeed(fixture({entries:[{...entry,commit:'private',taskId:'internal',secret:'hidden',links:[{href:'https://example.com/release',label:bilingual}]}]}))
  assert.deepEqual(parseChangelogFeed(fixture({entries:[{...entry,links:undefined}]})).entries[0].links,[])
  assert.equal(feed.entries[0].secret,undefined)
  assert.equal(feed.entries[0].commit,undefined)
  for (const href of ['javascript:alert(1)','http://example.com','https://user:password@example.com','/internal']) assert.throws(() => parseChangelogFeed(fixture({entries:[{...entry,links:[{href,label:bilingual}]}]})))
})
test('transport adapter validates and filters without global cache and honors cancellation', async () => {
  const client = createChangelogClient(async () => fixture())
  assert.equal((await client.list({suit:'shop-suit'})).entries.length,1)
  assert.equal((await client.list({suit:'ledger-suit'})).entries.length,0)
  await assert.rejects(createChangelogClient(async () => ({})).list())
  const controller = new AbortController(); controller.abort()
  await assert.rejects(client.list({},controller.signal))
})
test('SemVer precedence is numeric, prerelease-aware, precise and independent of build metadata', async () => {
  const { compareSuitVersions } = await import('../src/changelog.ts')
  const ascending = ['1.0.0-alpha','1.0.0-alpha.1','1.0.0-alpha.beta','1.0.0-beta','1.0.0-beta.2','1.0.0-beta.11','1.0.0-rc.1','1.0.0','1.0.2','1.0.10','1.9.0','1.10.0','2.0.0','10.0.0','9007199254740992.0.0','9007199254740993.0.0']
  assert.deepEqual([...ascending].reverse().sort(compareSuitVersions),ascending)
  assert.equal(compareSuitVersions('1.2.3+one','1.2.3+two'),0)
  assert.ok(compareSuitVersions('1.0.0-alpha-beta.9','1.0.0-alpha-beta.10')<0)
  assert.ok(compareSuitVersions('1.0.0-9007199254740992','1.0.0-9007199254740993')<0)
  assert.throws(()=>compareSuitVersions('not-a-version','1.0.0'))
})
test('batch publication keeps semantic release order and complete groups despite opaque IDs or shuffled delivery', async () => {
  const { selectChangelogReleases } = await import('../src/changelog.ts')
  const versions=['1.9.0','1.10.0','2.0.0-rc.1','2.0.0']
  const notes=versions.flatMap((version,index)=>[0,1,2].map(note=>({...entry,version,id:`${3-index}-${note}`})))
  const feed=parseChangelogFeed(fixture({entries:[...notes].reverse()}))
  const client=await createChangelogClient(async()=>feed).list({suit:'shop-suit'})
  assert.deepEqual([...new Set(client.entries.map(row=>row.version))],[...versions].reverse())
  const teaser=selectChangelogReleases(client,{suit:'shop-suit'},3)
  assert.equal(teaser.length,9)
  assert.deepEqual([...new Set(teaser.map(row=>row.version))],['2.0.0','2.0.0-rc.1','1.10.0'])
  assert.deepEqual(selectChangelogReleases({...client,entries:[...client.entries].reverse()},{suit:'shop-suit'},3),teaser)
  assert.ok(teaser.every(row=>row.publishedAt===entry.publishedAt&&isChangelogNew(row,client.serverNow)))
  assert.ok(teaser.every(row=>!isChangelogNew(row,'2026-10-11T12:00:00Z')))
  assert.deepEqual(selectChangelogReleases(client,{},0),[])
  for(const limit of [-1,0.5,Infinity]) assert.throws(()=>selectChangelogReleases(client,{},limit))
})
test('release groups keep Suits separate and exclude internal, future and Coming Soon entries', async () => {
  const { selectChangelogReleases } = await import('../src/changelog.ts')
  const planned={...entry,id:'planned',status:'coming-soon',targetVersion:'9.0.0'}
  delete planned.version;delete planned.releasedAt
  const feed=parseChangelogFeed(fixture({entries:[entry,{...entry,id:'same-version-other-suit',suit:'ledger-suit'},planned,{...entry,id:'internal',visibility:'internal'},{...entry,id:'future',publishedAt:'2026-11-01T12:00:00Z'}]}))
  assert.equal(selectChangelogReleases(feed,{},1).length,1)
  assert.equal(selectChangelogReleases(feed,{},2).length,2)
  assert.equal(selectChangelogReleases(feed,{suit:'shop-suit'},3).length,1)
})

test('overview keeps the complete single upcoming release ahead of frozen production history in both languages', async()=>{
  const {selectChangelogOverview}=await import('../src/changelog.ts')
  const planned={...entry,id:'upcoming-first',status:'coming-soon',targetVersion:'1.1.0',title:{en:'Service recipes',ar:'وصفات الخدمات'}}
  delete planned.version;delete planned.releasedAt
  const other={...planned,id:'upcoming-second',title:{en:'Taxes',ar:'الضرائب'}}
  const feed=parseChangelogFeed(fixture({entries:[entry,planned,other]}))
  const selected=selectChangelogOverview(feed,{suit:'shop-suit'},1)
  assert.equal(selected.length,2)
  assert.ok(selected.every(row=>row.status==='coming-soon'&&!isChangelogNew(row,feed.serverNow)))
  assert.equal(selected[0].title.ar,'وصفات الخدمات')
  assert.equal(selectChangelogOverview(feed,{suit:'shop-suit'},2).length,3)
  assert.throws(()=>selectChangelogOverview(feed,{},-1))
})
