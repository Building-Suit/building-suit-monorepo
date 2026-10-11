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
