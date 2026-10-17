// Actual disposable Supabase Auth/Storage/Functions acceptance. No hosted target.
import { spawn,spawnSync } from 'node:child_process'
import { readFile,mkdtemp,writeFile,rm,access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { validateLocalDoctorTarget } from './local-lifecycle.mjs'
import { DoctorProviderFailure,doctorProviderFailureSummary } from './provider-diagnostics.mjs'
const root = fileURLToPath(new URL('../../../',import.meta.url))
const app = path.join(root,'apps/doctor-suit')
const api = 'http://127.0.0.1:65321'; const origin = 'http://127.0.0.1:4341'
const project = 'building-suit-doctor'; const bucket = 'doctor-private-documents'
let stage = 'guard'; let owned = false; let functions; let functionsOutput = ''
const scratch = await mkdtemp(path.join(tmpdir(),'doctor-provider-'))
const environment = { ...process.env,SUPABASE_HOME: process.env.SUPABASE_HOME || path.join(scratch,'cli') }
const wait = ms => new Promise(resolve => setTimeout(resolve,ms))
function expect(value,label) { if (!value) throw new Error(label) }
function cli(args,timeout = 600000) {
  return new Promise((resolve,reject) => {
    const child = spawn('pnpm',['exec','supabase','--workdir',app,...args],{ cwd: root,env: environment,stdio: ['ignore','pipe','pipe'] })
    let output = ''; const timer = setTimeout(() => child.kill('SIGTERM'),timeout)
    child.stdout.on('data',data => { output+=data; if (output.length>16*1024*1024) child.kill('SIGTERM') })
    child.stderr.on('data',data => { output+=data; if (output.length>16*1024*1024) child.kill('SIGTERM') })
    child.once('error',() => { clearTimeout(timer); reject(new Error('CLI process unavailable')) })
    child.once('exit',code => { clearTimeout(timer); code===0 ? resolve(output) : reject(new DoctorProviderFailure(output)) })
  })
}
function docker(args) { const result = spawnSync('docker',args,{ encoding: 'utf8',timeout: 10000 }); expect(result.status===0,'Docker inspection failed'); return result.stdout.trim().split('\n').filter(Boolean) }
const options = { auth: { persistSession: false,autoRefreshToken: false,detectSessionInUrl: false } }
async function rpc(client,name,args) { const result = await client.rpc(name,args).abortSignal(AbortSignal.timeout(15000)); expect(!result.error,`RPC ${name} failed`); return result.data }
async function mail(email) {
  for (let attempt=0;attempt<60;attempt++) {
    const list = await fetch('http://127.0.0.1:65324/api/v1/messages').then(response => response.ok ? response.json() : null).catch(() => null)
    const entry = list?.messages?.find(item => item.To?.some(to => to.Address===email))
    if (entry) {
      const body = await fetch(`http://127.0.0.1:65324/api/v1/message/${encodeURIComponent(entry.ID)}`).then(response => response.json())
      const link = (body.HTML || body.Text || '').replaceAll('&amp;','&').match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/)
      if (link) return new URL(link[0])
    }
    await wait(250)
  }
  throw new Error('Local captured confirmation email unavailable')
}
async function bootstrap(publicKey,label) {
  const client = createClient(api,publicKey,options)
  const email = `synthetic-${label}-${randomUUID()}@example.test`; const password = `Synthetic-${randomUUID()}!9`
  const signup = await client.auth.signUp({ email,password,options: { emailRedirectTo: `${origin}/verify`,data: { display_name: `Synthetic ${label}` } } })
  expect(!signup.error && signup.data.user && !signup.data.session,'Unconfirmed signup must not admit a session')
  const unconfirmed = await client.auth.signInWithPassword({ email,password }); expect(unconfirmed.error && !unconfirmed.data.session,'Unconfirmed password admission rejected')
  const confirmation = await mail(email)
  expect(['127.0.0.1','localhost'].includes(confirmation.hostname),'Mail confirmation target must be local')
  const response = await fetch(confirmation,{ redirect: 'manual' }); expect(response.status>=300 && response.status<400,'Real Auth confirmation failed')
  const signin = await client.auth.signInWithPassword({ email,password }); expect(!signin.error && signin.data.session,'Confirmed password admission failed')
  const user = signin.data.user; const session = signin.data.session
  const verified = await rpc(client,'doctor_session_context'); expect(verified.user_id===user.id && verified.session_id,'Verified session must match actual Auth identity')
  const onboardingKey = randomUUID()
  const draft = await rpc(client,'doctor_save_onboarding_draft',{ p_key: onboardingKey,p_expected_version: 0,p_display_name: `Synthetic ${label}`,p_practice_name: `Synthetic ${label} practice`,p_location_name: `${label} clinic`,p_timezone: 'Africa/Cairo' })
  await rpc(client,'doctor_complete_onboarding',{ p_key: onboardingKey,p_draft_version: draft.version })
  const contexts = await rpc(client,'doctor_contexts'); const context = contexts.contexts?.[0] || contexts.options?.[0] || contexts[0]
  expect(context?.practice_id && context?.location_id,'Owned clinic context missing')
  const patient = await rpc(client,'doctor_write_patient',{ p_practice: context.practice_id,p_location: context.location_id,p_input: { name: `Synthetic ${label} patient`,phone: '',email: '',date_of_birth: null },p_key: randomUUID() })
  expect(patient.patient_id,'Patient creation failed')
  return { client,user,session,sessionId: verified.session_id,scope: { practiceId: context.practice_id,locationId: context.location_id,patientId: patient.patient_id } }
}
try {
  validateLocalDoctorTarget(JSON.parse(await readFile(path.join(root,'docs/architecture/environments.json'),'utf8')),await readFile(path.join(app,'supabase/config.toml'),'utf8'),process.env)
  try { await access(path.join(app,'supabase/.temp/project-ref')); throw new Error('Linked Doctor CLI directory is forbidden') } catch (error) { if (error.code!=='ENOENT') throw error }
  expect(!docker(['ps','-a','--format','{{.Names}}']).some(name => name.endsWith(`_${project}`)),'Existing project container is not owned by this run')
  expect(!docker(['volume','ls','--format','{{.Name}}']).some(name => name.endsWith(`_${project}`)),'Existing project volume is not owned by this run')
  owned = true; stage = 'start actual local services'; console.log('Starting owned disposable Doctor Auth/Storage/PostgREST/Functions services')
  await cli(['start','--exclude','studio,postgres-meta,logflare,vector,supavisor,realtime,imgproxy,edge-runtime'])
  stage = 'read private local runtime'; const raw = await cli(['status','-o','json'],30000)
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}'); const status = JSON.parse(raw.slice(start,end+1))
  expect(status.API_URL===api && status.ANON_KEY && status.SERVICE_ROLE_KEY,'Actual local target/status mismatch')
  // Never print captured CLI output, status keys, mail bodies, auth tokens or passwords.
  await writeFile(path.join(scratch,'function.env'),`DOCTOR_LOCAL_PROVIDER=1\nDOCTOR_WEB_ORIGIN=${origin}\n`,{ mode: 0o600 })
  functions = spawn('pnpm',['exec','supabase','--workdir',app,'functions','serve','doctor-documents','--env-file',path.join(scratch,'function.env')],{ cwd: root,env: environment,detached: true,stdio: ['ignore','pipe','pipe'] })
  functions.stdout.on('data',data => { functionsOutput=(functionsOutput+data).slice(-20000) }); functions.stderr.on('data',data => { functionsOutput=(functionsOutput+data).slice(-20000) })
  stage = 'configured private Storage bucket'; const storageAdmin = createClient(api,status.SERVICE_ROLE_KEY,options)
  const existingBucket = await storageAdmin.storage.getBucket(bucket)
  if (existingBucket.error) expect(!(await storageAdmin.storage.createBucket(bucket,{ public: false,fileSizeLimit: 5242880,allowedMimeTypes: ['application/pdf','image/png','image/jpeg'] })).error,'Supported local Storage bucket creation failed')
  stage = 'real Auth and owner onboarding'; const a = await bootstrap(status.ANON_KEY,'doctor-a'); const b = await bootstrap(status.ANON_KEY,'doctor-b')
  console.log('Actual Auth: captured local confirmation email, unconfirmed denial, verified session and two independent owner practices passed')
  const pdf = new TextEncoder().encode('%PDF-1.7\nSynthetic administrative attachment\n%%EOF\n')
  async function endpoint(actor,operation,data = {},bytes) {
    return fetch(`${api}/functions/v1/doctor-documents?op=${operation}`,{ method: 'POST',headers: { apikey: status.ANON_KEY,authorization: `Bearer ${actor.session.access_token}`,origin,'content-type': 'application/pdf','x-doctor-document': encodeURIComponent(JSON.stringify({ ...actor.scope,key: randomUUID(),...data })) },body: bytes,signal: AbortSignal.timeout(30000) })
  }
  stage = 'actual function startup'; let ready = false
  for (let attempt=0;attempt<60;attempt++) { const response = await endpoint(a,'status').catch(() => null); if (response?.status===200) { ready = true; break } await wait(500) }
  expect(ready,'Actual authenticated Edge Function failed readiness; captured logs withheld')
  stage = 'private upload and stable retry'; const key = randomUUID(); const result = await endpoint(a,'upload',{ key,filename: 'synthetic.pdf' },pdf); expect(result.status===200,'Real private upload failed'); const outcome = await result.json()
  const retry = await endpoint(a,'upload',{ key,filename: 'synthetic.pdf' },pdf); expect(retry.status===200 && JSON.stringify(await retry.json())===JSON.stringify(outcome),'Real upload retry changed identity')
  const directory = await rpc(a.client,'doctor_patient_documents',{ p_practice: a.scope.practiceId,p_location: a.scope.locationId,p_patient: a.scope.patientId }); expect(directory.total===1,'Actual upload must publish exactly one logical document')
  stage = 'private storage isolation'; const service = createClient(api,status.SERVICE_ROLE_KEY,options)
  const object = await rpc(service,'doctor_document_delivery',{ p_actor: a.user.id,p_session: a.sessionId,p_practice: a.scope.practiceId,p_location: a.scope.locationId,p_patient: a.scope.patientId,p_document: outcome.documentId,p_version: outcome.versionId }); expect(object?.object_path,'Stored immutable object locator missing')
  const locator = object.object_path
  const anonymous = createClient(api,status.ANON_KEY,options)
  expect((await anonymous.storage.from(bucket).download(locator)).error,'Anonymous private object download allowed')
  expect((await a.client.storage.from(bucket).download(locator)).error,'Direct authenticated Storage bypass allowed')
  const publicResponse = await fetch(`${api}/storage/v1/object/public/${bucket}/${locator}`); expect(!publicResponse.ok,'Public object URL exposed private bytes')
  const signed = await a.client.storage.from(bucket).createSignedUrl(locator,60); expect(signed.error,'Direct client could mint a signed bypass URL')
  const directWrite = await a.client.storage.from(bucket).upload(`bypass-${randomUUID()}.pdf`,pdf,{ contentType: 'application/pdf' }); expect(directWrite.error,'Direct client upload bypass allowed')
  stage = 'reject spoofed file'; expect((await endpoint(a,'upload',{ filename: 'spoof.pdf' },new TextEncoder().encode('<script>synthetic</script>'))).status===415,'Spoofed file accepted')
  stage = 'reject oversized file'; expect((await endpoint(a,'upload',{ filename: 'large.pdf' },new Uint8Array(5242881))).status===413,'Oversized file accepted')
  stage = 'reject cross-practice file'; expect((await endpoint(b,'download',{ ...a.scope,documentId: outcome.documentId })).status===403,'Cross-practice download allowed')
  stage = 'actual bytes and replacement history'; const downloaded = await endpoint(a,'download',{ documentId: outcome.documentId }); expect(downloaded.status===200 && Buffer.from(await downloaded.arrayBuffer()).equals(Buffer.from(pdf)),'Real download bytes differ')
  const replacement = await endpoint(a,'upload',{ filename: 'replacement.pdf',documentId: outcome.documentId,expectedVersion: 1 },pdf); expect(replacement.status===200,'Real replacement failed')
  const history = await rpc(a.client,'doctor_document_history',{ p_practice: a.scope.practiceId,p_location: a.scope.locationId,p_patient: a.scope.patientId,p_document: outcome.documentId }); expect(history.total===2 && history.versions.every(value => value.provenance==='uploaded_unreviewed' && value.uploaded_by===a.user.id),'Replacement lost immutable unreviewed provenance')
  const old = await endpoint(a,'download',{ documentId: outcome.documentId,versionId: outcome.versionId }); expect(old.status===200,'Original preserved file cannot be delivered to current authorized owner')
  stage = 'actual session revocation'; const frozen = { ...a,session: { ...a.session } }; expect(!(await a.client.auth.signOut({ scope: 'local' })).error,'Actual local session signout failed')
  const revoked = await endpoint(frozen,'download',{ documentId: outcome.documentId }); expect([401,403].includes(revoked.status),'Revoked JWT was admitted by document endpoint')
  expect((await endpoint(b,'status')).status===200,'Independent Doctor B was changed by A signout')
  console.log('Actual Storage/Functions: validated private bytes, stable retry, two preserved versions, anonymous/direct/public/signed bypass denials, cross-practice and revoked-session denials passed')
  console.log('Synthetic actual-provider acceptance passed. Realtime and hosted provider connections remain UNRUN.')
} catch (error) {
  console.error(`Doctor actual-provider acceptance failed at ${stage}: ${doctorProviderFailureSummary(error)}`)
  process.exitCode = 1
} finally {
  if (functions?.pid) {
    // The pnpm wrapper can exit before its CLI child. Own a separate process
    // group so cleanup covers that child without touching unrelated processes.
    try { process.kill(-functions.pid,'SIGTERM') } catch { /* already exited */ }
    if (functions.exitCode===null) await Promise.race([new Promise(resolve => functions.once('exit',resolve)),wait(5000)])
    try { process.kill(-functions.pid,'SIGKILL') } catch { /* owned group exited */ }
    functions.stdout.destroy(); functions.stderr.destroy(); functions.unref()
  }
  functionsOutput = ''
  if (owned) { try { await cli(['stop','--no-backup'],60000) } catch { console.error('Owned Doctor local cleanup failed'); process.exitCode = 1 } }
  await rm(scratch,{ recursive: true,force: true })
}
