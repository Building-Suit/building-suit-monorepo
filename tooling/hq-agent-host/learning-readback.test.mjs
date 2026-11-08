import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto'
import { createBrainPublisher } from './brainPublisher.mjs'
const hash=value=>createHash('sha256').update(value).digest('hex')
const root='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8',file='synthetic_learning_file',folder='synthetic_parent_folder'
const key=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'})
const base='---\nid: BRAIN-HQ-REVIEWED-LEARNING\n---\n# HQ Reviewed Learning\n<!-- hq-learning-entries -->\n'
function fixture(plans=[{}],putFailure){
 const lesson={id:randomUUID(),source_type:'task',source_id:randomUUID(),source_digest:'a'.repeat(64),summary:'Generated fixture',body:'Synthetic evidence only.'}
 lesson.digest=hash('task'+lesson.source_id+lesson.body)
 let text=base,puts=0,targetReads=0,mediaReads=0;const calls=[]
 const fetch=async(url,options={})=>{
  calls.push({url,method:options.method||'GET'})
  if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-token',expires_in:3600})
  const u=new URL(url),id=u.pathname.split('/').at(-1)
  if(options.method==='PUT'){
   puts++;text=String(options.body)
   if(putFailure==='transport')throw Error('synthetic private diagnostic')
   if(putFailure==='body')return new Response(new ReadableStream({start(c){c.error(Error('synthetic body failure'))}}))
   if(putFailure==='http')return new Response('',{status:500})
   if(putFailure==='invalid-utf8')return new Response(new Uint8Array([0xff]))
   return Response.json({id:file})
  }
  const attempt=Math.max(0,Math.ceil(targetReads/2)-1),plan=plans[Math.min(attempt,plans.length-1)]
  if(u.pathname.includes('/v2/'))return Response.json({id:file,title:'HQ Reviewed Learning.md',mimeType:'text/markdown',labels:{trashed:false},version:'1',etag:'"synthetic-etag"'})
  if(u.searchParams.get('alt')==='media'){
   if(puts)mediaReads++
   return new Response(puts && plan.media===false ? (plan.stale?base:text+'\nConcurrent unrelated text.') : text)
  }
  if(id===file){
   if(puts){targetReads++;const current=plans[Math.min(Math.ceil(targetReads/2)-1,plans.length-1)]
    if(current.auth)return new Response('',{status:403})
    if(current.malformed)return new Response('{')
    if(current.oversize)return new Response('x'.repeat(40001))
    if(current.abort && targetReads%2===0)setTimeout(()=>current.abort.abort(),20)
    return Response.json({id:file,name:'HQ Reviewed Learning.md',mimeType:'text/markdown',parents:[current.scope?'outside_synthetic':folder],trashed:false,ownedByMe:false,capabilities:{canEdit:true},
      version:current.badVersion?'':String(current.version??(current.unstable&&targetReads%2===0?3:2))})
   }
   return Response.json({id:file,name:'HQ Reviewed Learning.md',mimeType:'text/markdown',parents:[folder],trashed:false,ownedByMe:false,capabilities:{canEdit:true},version:'1'})
  }
  if(id==='outside_synthetic')return Response.json({id,mimeType:'text/plain',trashed:false,parents:[]})
  return Response.json({id,mimeType:'application/vnd.google-apps.folder',trashed:false,parents:id===folder?[root]:[]})
 }
 const publisher=createBrainPublisher({googleEmail:'synthetic@example.invalid',googleKey:key,brainRoot:root,learningFileId:file},{fetch})
 return {calls,run:signal=>publisher.publishLesson(lesson,signal),get puts(){return puts},get passes(){return targetReads/2},get mediaReads(){return mediaReads},get targetReads(){return targetReads}}
}
test('immediate success uses one PUT and one whole verification pass',async()=>{
 const h=fixture();assert.ok((await h.run()).digest);assert.equal(h.puts,1);assert.equal(h.passes,1)
})
for(const [name,first] of [['stale media',{media:false,stale:true}],['unstable version',{unstable:true}]])test(name+' can converge at a later complete version',async()=>{
 const h=fixture([first,{version:9}]);assert.ok((await h.run()).digest);assert.equal(h.puts,1);assert.equal(h.passes,2)
})
test('persistent wrong whole-file media with correct entry exhausts three reads, never rewrites',async()=>{
 const h=fixture([{media:false}]);await assert.rejects(h.run(),/learning-readback-media-conflict/);assert.equal(h.puts,1);assert.equal(h.passes,3)
})
test('version and media checks cannot be combined across different attempts',async()=>{
 const h=fixture([{unstable:true},{media:false},{unstable:true}]);await assert.rejects(h.run(),/learning-readback-version-conflict/);assert.equal(h.puts,1);assert.equal(h.passes,3)
})
for(const [name,plan,code] of [['scope',{scope:true},/learning-scope-required/],['auth',{auth:true},/learning-authorization-required/],['malformed',{malformed:true},/learning-invalid-response/],['size',{oversize:true},/learning-response-too-large/],['missing version',{badVersion:true},/learning-invalid-response/]])test(name+' failure is not retried',async()=>{
 const h=fixture([plan]);await assert.rejects(h.run(),code);assert.equal(h.puts,1);assert.ok(h.targetReads<=2)
})
for(const outcome of ['transport','body','http','invalid-utf8'])test('unknown PUT '+outcome+' outcome does not enter read retries or repeat PUT',async()=>{
 const h=fixture([{}],outcome);await assert.rejects(h.run());assert.equal(h.puts,1);assert.equal(h.targetReads,0)
})
test('already canceled parent prevents authentication and every Drive request',async()=>{
 const controller=new AbortController();controller.abort();const h=fixture()
 await assert.rejects(h.run(controller.signal));assert.equal(h.calls.length,0);assert.equal(h.puts,0)
})
test('parent cancellation during retry delay prevents the next GET',async()=>{
 const controller=new AbortController(),h=fixture([{media:false,abort:controller}])
 await assert.rejects(h.run(controller.signal));assert.equal(h.puts,1);assert.equal(h.targetReads,2)
})
for(const duration of [10000,90000])test('independent '+duration+'ms deadline works even with a non-expiring parent',async()=>{
 const timeout=AbortSignal.timeout
 AbortSignal.timeout=ms=>timeout(ms===duration?40:ms)
 try{
  const h=fixture([{media:false}]);await assert.rejects(h.run(new AbortController().signal));assert.equal(h.puts,1);assert.equal(h.targetReads,2)
 }finally{AbortSignal.timeout=timeout}
})
