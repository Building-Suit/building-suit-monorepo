/** Reviewed-learning publication only. Never creates files or edits Brain sources. */
import { createHash, createSign } from 'node:crypto'
const ROOT = '1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'
const ID = /^[A-Za-z0-9_-]{8,200}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH = /^[0-9a-f]{64}$/
const MARKER = '<!-- hq-learning-entries -->'
const MAX_BYTES = 40_000
const CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/
const hash = text => createHash('sha256').update(text).digest('hex')
function demand(value, code) { if (!value) { const error = new Error(code); error.code = code; throw error } }
function plain(value) { return value && typeof value === 'object' && !Array.isArray(value) }
function validLesson(lesson) {
  demand(plain(lesson) && Object.keys(lesson).every(key => ['id','summary','body','source_type','source_id','source_digest','digest'].includes(key)) && UUID.test(lesson.id || '') && ['task','conversation'].includes(lesson.source_type)
    && UUID.test(lesson.source_id || '') && HASH.test(lesson.source_digest || '') && HASH.test(lesson.digest || '')
    && typeof lesson.summary === 'string' && lesson.summary.trim() && lesson.summary.length <= 240
    && typeof lesson.body === 'string' && lesson.body.trim() && Buffer.byteLength(lesson.body) <= 8000
    && !CONTROLS.test(lesson.summary + lesson.body) && !/<!--\s*\/?hq-/i.test(lesson.summary + lesson.body), 'learning-invalid-record')
  demand(hash(lesson.source_type + lesson.source_id + lesson.body) === lesson.digest, 'learning-invalid-digest')
}
function header(text) {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  demand(frontmatter && /^id:\s*BRAIN-HQ-REVIEWED-LEARNING\s*$/m.test(frontmatter[1])
    && /^# HQ Reviewed Learning\s*$/m.test(text) && text.split(MARKER).length === 2, 'learning-header-required')
}
/** Only precisely delimited old machine entries may rotate; human text survives. */
export function appendReviewedLesson(text, lesson) {
  validLesson(lesson); header(text)
  demand(Buffer.byteLength(text) <= MAX_BYTES, 'learning-journal-too-large')
  const start = `<!-- hq-lesson:${lesson.id}:${lesson.digest} -->`
  const finish = `<!-- /hq-lesson:${lesson.id} -->`
  const existing = new RegExp('<!-- hq-lesson:' + lesson.id + ':([0-9a-f]{64}) -->', 'g')
  const matches = [...text.matchAll(existing)]
  if (matches.length) {
    demand(matches.length === 1 && matches[0][1] === lesson.digest && text.includes(finish), 'learning-entry-conflict')
    const region = text.slice(matches[0].index, text.indexOf(finish, matches[0].index) + finish.length)
    demand(region.includes(`Source: ${lesson.source_type} ${lesson.source_id}`) && region.includes(`Source digest: ${lesson.source_digest}`)
      && region.includes(lesson.body), 'learning-entry-conflict')
    return { text, duplicate: true }
  }
  demand(!text.includes(`hq-lesson:${lesson.id}:`) && !text.includes(finish), 'learning-entry-conflict')
  const title = lesson.summary.replace(/[\r\n]/g,' ')
  const entry = `\n\n${start}\n<a id="lesson-${lesson.id}"></a>\n## ${title}\n\n${lesson.body}\n\nSource: ${lesson.source_type} ${lesson.source_id}\nSource digest: ${lesson.source_digest}\nLesson digest: ${lesson.digest}\n${finish}\n`
  let next = text + entry
  if (Buffer.byteLength(next) > MAX_BYTES) {
    const entries = /<!-- hq-lesson:([0-9a-f-]{36}):[0-9a-f]{64} -->[\s\S]*?<!-- \/hq-lesson:\1 -->/g
    const old = [...text.matchAll(entries)]
    for (const match of old) {
      if (Buffer.byteLength(next) <= MAX_BYTES) break
      // Never rotate entries before the reserved managed section.
      if (match.index > text.indexOf(MARKER)) next = next.replace(match[0], '')
    }
  }
  demand(Buffer.byteLength(next) <= MAX_BYTES, 'learning-journal-capacity')
  return { text: next, duplicate: false }
}

export function createBrainPublisher(config, { fetch: transport = globalThis.fetch } = {}) {
  let bearer = null, deadline = 0
  async function exchange(url, options, max = 40_000) {
    let response
    try { response = await transport(url, { ...options, redirect:'error' }) }
    catch { demand(false,'learning-transport-unavailable') }
    if (response.status === 412) { await response.body?.cancel().catch(()=>{}); demand(false,'learning-source-conflict') }
    if (!response.ok) { await response.body?.cancel().catch(()=>{}); demand(false,response.status === 401 || response.status === 403 ? 'learning-authorization-required' : 'learning-remote-unavailable') }
    const declared = response.headers.get('content-length')
    demand(!declared || /^\d+$/.test(declared) && Number(declared) <= max,'learning-response-too-large')
    const chunks=[]; let size=0
    for await (const chunk of response.body || []) { size+=chunk.byteLength; demand(size<=max,'learning-response-too-large');chunks.push(Buffer.from(chunk)) }
    let text
    try {text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))}catch{demand(false,'learning-invalid-response')}
    return {text,etag:response.headers.get('etag')}
  }
  async function json(url,options) {const value=await exchange(url,options,32_000);try{return {value:JSON.parse(value.text),etag:value.etag}}catch{demand(false,'learning-invalid-response')}}
  async function token(signal) {
    if (bearer && deadline>Date.now()+60_000)return bearer
    demand(config.googleEmail && config.googleKey,'learning-configuration-required')
    const now=Math.floor(Date.now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
    const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:config.googleEmail,scope:'https://www.googleapis.com/auth/drive',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})
    let signature;try{signature=createSign('RSA-SHA256').update(unsigned).sign(config.googleKey,'base64url')}catch{demand(false,'learning-configuration-required')}
    const {value}=await json('https://oauth2.googleapis.com/token',{method:'POST',signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature})})
    demand(typeof value.access_token==='string' && Number.isFinite(value.expires_in),'learning-invalid-response')
    bearer=value.access_token;deadline=Date.now()+value.expires_in*1000;return bearer
  }
  return {async publishLesson(lesson, parentSignal) {
    validLesson(lesson)
    demand(config.brainRoot===ROOT && ID.test(config.learningFileId || ''),'learning-configuration-required')
    const fileId=config.learningFileId, signal=parentSignal || AbortSignal.timeout(90_000)
    const headers={Authorization:'Bearer '+await token(signal),'Cache-Control':'no-cache'}
    const metadata=async id=>json('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)
      +'?supportsAllDrives=true&fields=id,name,mimeType,parents,trashed,version,ownedByMe,capabilities(canEdit)',{headers,signal})
    // v3 omits the file resource ETag. v2 exposes its own strong resource
    // validator; it must be used with the matching v2 update endpoint.
    const validator=async()=>{
      const value=await json('https://www.googleapis.com/drive/v2/files/'+encodeURIComponent(fileId)
        +'?supportsAllDrives=true&fields=id,etag,version,title,mimeType,labels(trashed)',{headers,signal})
      demand(value.value.id===fileId && value.value.title==='HQ Reviewed Learning.md'
        && ['text/markdown','text/plain'].includes(value.value.mimeType) && value.value.labels?.trashed===false,'learning-output-required')
      demand(typeof value.value.etag==='string' && /^"[^"\r\n]{1,200}"$/.test(value.value.etag),'learning-cas-required')
      return value.value
    }
    const verifyScope=async()=>{
      const first=await metadata(fileId), value=first.value
      demand(value.id===fileId && value.trashed===false && ['text/markdown','text/plain'].includes(value.mimeType)
        && value.name==='HQ Reviewed Learning.md' && value.ownedByMe===false && value.capabilities?.canEdit===true,'learning-output-required')
      const pending=[{value,depth:0}],seen=new Set();let found=false
      while(pending.length){const current=pending.shift();demand(current.depth<=32 && seen.size<=64,'learning-scope-required')
        if(seen.has(current.value.id))continue;seen.add(current.value.id)
        demand(Array.isArray(current.value.parents) && current.value.parents.length<=10,'learning-scope-required')
        for(const parent of current.value.parents){demand(ID.test(parent),'learning-scope-required');const node=await metadata(parent)
          demand(node.value.id===parent && !node.value.trashed && node.value.mimeType==='application/vnd.google-apps.folder','learning-scope-required')
          if(parent===ROOT){found=true;break}pending.push({value:node.value,depth:current.depth+1})}
        if(found)break
      }
      demand(found,'learning-scope-required');return first
    }
    for(let attempt=0;attempt<2;attempt++){
      const before=await verifyScope(), beforeValidator=await validator()
      demand(beforeValidator.version===before.value.version,'learning-source-conflict')
      const media=await exchange('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId)+'?alt=media&supportsAllDrives=true',{headers,signal})
      const current=await metadata(fileId), currentValidator=await validator()
      demand(typeof before.value.version==='string' && before.value.version===current.value.version
        && current.value.version===currentValidator.version && beforeValidator.etag===currentValidator.etag,'learning-source-conflict')
      const result=appendReviewedLesson(media.text,lesson)
      const receipt={reference:'https://drive.google.com/file/d/'+fileId+'/view#lesson-'+lesson.id,digest:lesson.digest}
      if(result.duplicate)return receipt
      // Use the provider-issued resource validator, never a fabricated version.
      const etag=currentValidator.etag
      try {
        await exchange('https://www.googleapis.com/upload/drive/v2/files/'+encodeURIComponent(fileId)+'?uploadType=media&supportsAllDrives=true&fields=id,etag,version',{
          method:'PUT',signal,headers:{...headers,'Content-Type':'text/markdown; charset=utf-8','If-Match':etag},body:result.text},32_000)
      }catch(error){if(error.code==='learning-source-conflict' && attempt===0)continue;throw error}
      const after=await verifyScope()
      const readback=await exchange('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId)+'?alt=media&supportsAllDrives=true',{headers,signal})
      const confirmed=await metadata(fileId)
      demand(after.value.version===confirmed.value.version && hash(readback.text)===hash(result.text),'learning-readback-conflict')
      demand(appendReviewedLesson(readback.text,lesson).duplicate,'learning-readback-conflict')
      return receipt
    }
    demand(false,'learning-source-conflict')
  }}
}
