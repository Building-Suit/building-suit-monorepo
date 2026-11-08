import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto'
import { appendReviewedLesson, createBrainPublisher, verifyLessonReadback } from './brainPublisher.mjs'
const root='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8', output='learning_output_123', parent='work_output_folder_123'
const hash=text=>createHash('sha256').update(text).digest('hex')
const base='---\nid: BRAIN-HQ-REVIEWED-LEARNING\ntype: reviewed_learning\nstatus: maintained\ncustodian: AG-CEO-001\n---\n\n# HQ Reviewed Learning\n\nHuman authored explanation stays intact.\n\n<!-- hq-learning-entries -->\n'
const makeLesson=(body='Use observed evidence rather than invented actions.')=>{const value={id:randomUUID(),source_type:'task',source_id:randomUUID(),source_digest:'a'.repeat(64),summary:'Evidence-backed learning',body};return {...value,digest:hash(value.source_type+value.source_id+value.body)}}
const key=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'})
function transportFixture(settings={}){
 let text=settings.text??base,version=1,patches=0,conflicts=settings.conflicts??0;const calls=[]
 const fetch=async(url,options={})=>{
  calls.push({url,method:options.method||'GET',headers:options.headers})
  if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'mock-private-access',expires_in:3600})
  const id=new URL(url).pathname.split('/').at(-1)
  if(options.method==='PUT'){
   patches++;assert.equal(id,output);assert.equal(options.headers['If-Match'],'"version-'+version+'"')
   if(conflicts-->0){text+='\nHuman concurrent update.\n';version++;return new Response('',{status:412})}
   text=String(options.body);version++;return Response.json({id:output})
  }
  if(new URL(url).pathname.startsWith('/drive/v2/files/')) return Response.json({id:output,title:'HQ Reviewed Learning.md',mimeType:'text/markdown',labels:{trashed:false},version:String(version),...(settings.noEtag?{}:{etag:'"version-'+version+'"'})})
  if(new URL(url).searchParams.get('alt')==='media')return new Response(settings.readbackMismatch&&patches?text+'changed':text)
  if(settings.versionDrift && patches && calls.filter(x=>x.url.includes('alt=media')).length===2)version++;
  const file=id===output?{id,name:'HQ Reviewed Learning.md',mimeType:'text/markdown',parents:[settings.outside?'outside_folder_123':parent],trashed:false,version:String(version),ownedByMe:false,capabilities:{canEdit:true}}:
    {id,name:'Folder',mimeType:'application/vnd.google-apps.folder',parents:id===parent?[root]:[],trashed:false,version:'1'}
  return Response.json(file)
 }
 const publisher=createBrainPublisher({googleEmail:'reader@example.invalid',googleKey:key,brainRoot:root,learningFileId:output},{fetch})
 return {publisher,calls,get text(){return text},get patches(){return patches}}
}
test('one exact-file v2 conditional append without v3 ETag, readback, duplicate retry and fixed reviewed digest receipt',async()=>{
 const h=transportFixture(),lesson=makeLesson(),receipt=await h.publisher.publishLesson(lesson)
 assert.equal(h.patches,1);assert.match(h.text,/Human authored explanation stays intact/);assert.match(h.text,new RegExp(lesson.digest));assert.equal(receipt.digest,lesson.digest)
 assert.equal(receipt.reference,'https://drive.google.com/file/d/'+output+'/view#lesson-'+lesson.id)
 assert.deepEqual(await h.publisher.publishLesson(lesson),receipt);assert.equal(h.patches,1)
 assert.ok(h.calls.filter(x=>x.method==='PUT').every(x=>x.url.startsWith('https://www.googleapis.com/upload/drive/v2/files/'+output+'?')))
})
test('known conditional conflict reloads human edit, without stale replacement or duplicate lesson',async()=>{
 const h=transportFixture({conflicts:1}),lesson=makeLesson();await h.publisher.publishLesson(lesson)
 assert.equal(h.patches,2);assert.match(h.text,/Human concurrent update/);assert.equal(h.text.split('<!-- hq-lesson:'+lesson.id+':').length,2)
})
test('scope, CAS, size, header, malformed/rejected and readback failures cannot publish a receipt',async()=>{
 for(const [settings,code] of [[{outside:true},/learning-scope-required/],[{noEtag:true},/learning-cas-required/],[{text:'x'.repeat(40001)},/learning-response-too-large/],[{text:'# Wrong file'},/learning-header-required/],[{readbackMismatch:true},/learning-readback-media-conflict/]]){
  const h=transportFixture(settings);await assert.rejects(()=>h.publisher.publishLesson(makeLesson()),code)
  if(!settings.readbackMismatch)assert.equal(h.patches,0)
 }
 const h=transportFixture();await assert.rejects(()=>h.publisher.publishLesson({...makeLesson(),status:'rejected'}),/learning-invalid-record/)
 await assert.rejects(()=>h.publisher.publishLesson({...makeLesson(),digest:'0'.repeat(64)}),/learning-invalid-digest/)
 assert.equal(h.patches,0)
})
test('managed journal rotates old managed entries within40KB while preserving human text; duplicate conflicts fail',()=>{
 let text=base+'\nHuman footer remains.\n';let last
 for(let index=0;index<10;index++){last=makeLesson('Lesson '+index+' '+ 'evidence '.repeat(700));text=appendReviewedLesson(text,last).text;assert.ok(Buffer.byteLength(text)<=40000)}
 assert.match(text,/Human authored explanation stays intact/);assert.match(text,/Human footer remains/);assert.equal(appendReviewedLesson(text,last).duplicate,true)
 const changed={...last,body:'Changed'};changed.digest=hash(changed.source_type+changed.source_id+changed.body)
 assert.throws(()=>appendReviewedLesson(text,changed),/learning-entry-conflict/)
 assert.throws(()=>appendReviewedLesson(base,makeLesson('<!-- hq-lesson:spoof -->')),/learning-invalid-record/)
})

 test('readback predicates fail closed with fixed codes and preserve worker redaction',async()=>{
 const {codeOf}=await import('./worker.mjs')
 for(const [checks,code] of [
  [{versionMatches:false,mediaMatches:true,duplicate:true},'learning-readback-version-conflict'],
  [{versionMatches:true,mediaMatches:false,duplicate:true},'learning-readback-media-conflict'],
  [{versionMatches:true,mediaMatches:true,duplicate:false},'learning-readback-entry-conflict'],
  [{versionMatches:undefined,mediaMatches:true,duplicate:true},'learning-readback-version-conflict']]){
  assert.throws(()=>verifyLessonReadback(checks),error=>{
   assert.equal(error.message,code);assert.equal(codeOf(error),code)
   assert.deepEqual(Object.keys(error),['code']);return true
  })
 }
 verifyLessonReadback({versionMatches:true,mediaMatches:true,duplicate:true})
 assert.equal(codeOf({message:'private fixture',code:'private fixture'}),'worker-unavailable')
 const h=transportFixture({versionDrift:true})
 assert.ok((await h.publisher.publishLesson(makeLesson())).digest)
 assert.equal(h.patches,1)
})
