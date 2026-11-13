/** Synthetic protocol-shaped fixtures only; no live provider calls or claimed page bodies. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { nativeToolReceipt } from './worker.mjs'
const observedAt = '2026-11-08T00:00:00.000Z'
const receipt = input => nativeToolReceipt({id:'web_fixture',type:'web_search',...input}, observedAt)

test('same-event URL-only targets are enriched without changing their identity or borrowing another source', () => {
  const value = receipt({action:{type:'open',urls:['https://example.com/a','https://example.com/b']},sources:[
    {url:'https://example.com/a',title:'A',snippet:'Exact observed A excerpt'},
    {url:'https://example.com/b',title:'B'},
    {url:'https://example.com/a',title:'Later A',snippet:'Other A excerpt'}]})
  assert.deepEqual(value.sources,[{url:'https://example.com/a',title:'A',excerpt:'Exact observed A excerpt'},{url:'https://example.com/b',title:'B',excerpt:null}])
  assert.equal(value.observedAt, observedAt)
})

test('line-count-only live receipt observation is not a factual quotation; no missing body is invented', () => {
  const value = receipt({sources:[{url:'https://example.com/a',snippet:'Total lines: 294'},
    {url:'https://example.com/b',text:' Total lines: 0\n '},{url:'https://example.com/c'}]})
  assert.ok(value.sources.every(source => source.excerpt === null))
  assert.equal(value.sources.length,3)
  assert.equal(value.truncated,false)
})

test('an existing supported content field can supply observed excerpt after metadata, but model prose cannot', () => {
  const value = receipt({sources:[{url:'https://example.com/a',snippet:'Total lines: 100',content:'Observed page content'},
    {url:'https://example.com/b'}],text:'Unattributed narrative cannot become a source excerpt'})
  assert.equal(value.sources[0].excerpt,'Observed page content')
  assert.equal(value.sources[1].excerpt,null)
})

test('URLs embedded in queries, titles and excerpts are redacted as well as source URLs', () => {
  const value = receipt({query:'Read https://example.com/a?access_token=private-token#token=hidden-fragment and https://192.168.1.2/private',
    sources:[{url:'https://example.com/a?X-Amz-Credential=private-credential&X-Amz-Signature=private-signature&p=1#hidden-fragment',
      title:'See https://[fc00::1]/private',snippet:'https://user:private-password@example.com/private https://example.com/b?client_secret=private-secret and Bearer private-bearer'},
      {url:'https://localhost/private'},{url:'https://[::ffff:192.168.1.2]/private'},{url:'https://home.internal/private'},{url:'https://2130706433/private'}]})
  assert.equal(value.sources.length,1)
  assert.equal(value.sources[0].url,'https://example.com/a?p=1')
  assert.doesNotMatch(JSON.stringify(value),/private-(?:token|credential|signature|password|secret|bearer)|hidden-fragment|192\.168|fc00|localhost|home\.internal/)
  assert.match(JSON.stringify(value),/redacted URL/)
})

test('source, traversal and UTF-8 excerpt limits remain explicit, while existing sources still enrich at capacity', () => {
  const urls=Array.from({length:9},(_,i)=>`https://example.com/${i}`)
  const value=receipt({urls,sources:[{url:urls[0],snippet:'é'.repeat(1000)}]})
  assert.equal(value.sources.length,8)
  assert.equal(Buffer.byteLength(value.sources[0].excerpt),1200)
  assert.equal(value.truncated,true)
  const wide=Object.fromEntries(Array.from({length:65},(_,i)=>['field'+i,{}]))
  assert.equal(receipt(wide).truncated,true)
  let nested={};for(let i=0;i<10;i++)nested={nested}
  assert.equal(receipt(nested).truncated,true)
})
