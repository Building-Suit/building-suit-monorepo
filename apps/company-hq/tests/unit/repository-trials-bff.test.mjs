/** Generated fixed-repository commands; no provider, database or model calls. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
registerHooks({ resolve(specifier,context,next) {
  if(specifier==='h3')return {url:'data:text/javascript,'+encodeURIComponent(`export const createError=x=>Object.assign(new Error(x.statusMessage),x);export const getHeader=(e,k)=>e.node.req.headers[k];export const setResponseHeader=(e,k,v)=>e.node.res.setHeader(k,v)`),shortCircuit:true}
  if(context.parentURL?.includes('/server/api/hq/')&&/utils\/hqAccess$/.test(specifier))return {url:'data:text/javascript,'+encodeURIComponent(`export async function requireHqFounder(){if(!globalThis.__repository.authorized)throw Object.assign(new Error('denied'),{statusCode:403});return{accessToken:'synthetic'}};export async function hqRpc(c,t,name,args){globalThis.__repository.calls.push({name,args});return{accepted:true}}`),shortCircuit:true}
  if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier)&&context.parentURL?.includes('/apps/company-hq/'))return next(specifier+'.ts',context)
  return next(specifier,context)
} })
globalThis.defineEventHandler=x=>x;globalThis.useRuntimeConfig=()=>({})
const {default:post}=await import('../../server/api/hq/repository-trials/index.post.ts')
const event=(body,headers={})=>{const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.headers={'content-type':'application/json',...headers};return {node:{req,res:{setHeader(){}}}}}
const requestKey=randomUUID(),bundleId=randomUUID(),trialId=randomUUID(),predecessorArtifactId=randomUUID()
const freeze={action:'freeze',agentId:'AG-DEV-002',preset:'hq-worker-boundary-v1',mode:'snapshot',sha:'a'.repeat(40),pullRequestNumber:null,predecessorArtifactId:null,requestKey}
test('repository BFF requires founder and maps exact fixed freeze/start/qualification contracts',async()=>{
  globalThis.__repository={authorized:false,calls:[]}
  await assert.rejects(()=>post(event(freeze)),e=>e.statusCode===403);assert.equal(globalThis.__repository.calls.length,0)
  globalThis.__repository.authorized=true
  await post(event(freeze));assert.deepEqual(globalThis.__repository.calls.at(-1),{name:'hq_freeze_repository_bundle',args:{p_agent_id:freeze.agentId,p_preset:freeze.preset,p_mode:freeze.mode,p_sha:freeze.sha,p_pull_request_number:null,p_predecessor_artifact_id:null,p_request_key:requestKey}})
  await post(event({action:'start',agentId:freeze.agentId,bundleId,requestKey}));assert.deepEqual(globalThis.__repository.calls.at(-1),{name:'hq_begin_repository_trial',args:{p_agent_id:freeze.agentId,p_bundle_id:bundleId,p_request_key:requestKey}})
  await post(event({action:'qualify',trialId}));assert.deepEqual(globalThis.__repository.calls.at(-1),{name:'hq_issue_repository_qualification',args:{p_trial_id:trialId}})
  for(const body of [{...freeze,agentId:'AG-DEV-003',predecessorArtifactId},{...freeze,agentId:'AG-DEV-004',preset:'hq-ci-config-v1'},{...freeze,mode:'stg'},{...freeze,mode:'approved-pr',pullRequestNumber:42}])await post(event(body))
  assert.equal(globalThis.__repository.calls.length,7)
})
test('repository BFF rejects paths URLs queries role changes malformed bindings and oversized bodies before RPC',async()=>{
  globalThis.__repository={authorized:true,calls:[]}
  for(const change of [{url:'https://example.org'},{path:'README.md'},{query:'private text'},{repo:'other'},{agentId:'AG-CEO-001'},{preset:'arbitrary'},{preset:'hq-ci-config-v1'},{sha:'A'.repeat(40)},{sha:'a'.repeat(39)},{sha:'https://example.org'},{mode:'branch'},{pullRequestNumber:1},{mode:'approved-pr',pullRequestNumber:null},{mode:'approved-pr',pullRequestNumber:0},{mode:'approved-pr',pullRequestNumber:1.5},{mode:'approved-pr',pullRequestNumber:2147483648},{predecessorArtifactId},{agentId:'AG-DEV-003'},{agentId:'AG-DEV-003',predecessorArtifactId:'bad'},{requestKey:'bad'}])await assert.rejects(()=>post(event({...freeze,...change})),e=>e.statusCode===400)
  for(const body of [{action:'start',agentId:freeze.agentId,bundleId:null,requestKey},{action:'start',agentId:freeze.agentId,bundleId,requestKey,path:'x'},{action:'qualify',trialId,agentId:freeze.agentId},[],null])await assert.rejects(()=>post(event(body)),e=>e.statusCode===400)
  await assert.rejects(()=>post(event(freeze,{'content-length':'99999'})),e=>e.statusCode===400)
  assert.equal(globalThis.__repository.calls.length,0)
})
