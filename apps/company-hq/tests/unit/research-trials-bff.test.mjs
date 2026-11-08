/** Isolated transport contract; no Auth provider, database or model requests. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
registerHooks({ resolve(specifier,context,nextResolve) {
  if(specifier==='h3')return{url:'data:text/javascript,'+encodeURIComponent(`export const createError=x=>Object.assign(new Error(x.statusMessage),x);export const getHeader=(event,key)=>event.node.req.headers[key];export const setResponseHeader=(event,key,value)=>event.node.res.setHeader(key,value)`),shortCircuit:true}
  if (context.parentURL?.includes('/server/api/hq/research-trials') && /utils\/hqAccess$/.test(specifier)) {
    return {url:'data:text/javascript,'+encodeURIComponent(`export async function requireHqFounder(){if(!globalThis.__trialFixture.authorized)throw Object.assign(new Error('denied'),{statusCode:403});return{accessToken:'synthetic-token'}};export async function hqRpc(config,token,name,args){globalThis.__trialFixture.calls.push({name,args});return{accepted:true}}`),shortCircuit:true}
  }
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes('/apps/company-hq/')) return nextResolve(specifier+'.ts',context)
  return nextResolve(specifier,context)
}})
globalThis.defineEventHandler=fn=>fn
globalThis.useRuntimeConfig=()=>({})
const {default:post}=await import('../../server/api/hq/research-trials.post.ts')
const {default:qualify}=await import('../../server/api/hq/research-trials/qualification.post.ts')
function event(body,headers={}) {
 const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.headers={'content-type':'application/json',...headers}
 return {node:{req,res:{setHeader(){}}}}
}
test('Research tool trial BFF binds founder and exact commands without arbitrary agent/tool inputs',async()=>{
 globalThis.__trialFixture={authorized:false,calls:[]}
 const requestKey=randomUUID(),skillFileId='synthetic_skill_01',trialId=randomUUID()
 await assert.rejects(()=>post(event({skillFileId,requestKey})),error=>error.statusCode===403)
 await assert.rejects(()=>qualify(event({trialId})),error=>error.statusCode===403)
 assert.deepEqual(globalThis.__trialFixture.calls,[])
 globalThis.__trialFixture.authorized=true
 await post(event({skillFileId,requestKey}));await qualify(event({trialId}))
 assert.deepEqual(globalThis.__trialFixture.calls,[{name:'hq_begin_public_research_trial',args:{p_skill_file_id:skillFileId,p_request_key:requestKey}},{name:'hq_issue_public_research_qualification',args:{p_trial_id:trialId}}])
 for(const body of [{skillFileId,requestKey,agentId:'AG-RES-003'},{skillFileId,requestKey,url:'https://business.org'},{skillFileId:'invalid',requestKey},{skillFileId,requestKey:'invalid'}])await assert.rejects(()=>post(event(body)),error=>error.statusCode===400)
 await assert.rejects(()=>qualify(event({trialId,qualified:true})),error=>error.statusCode===400)
 assert.equal(globalThis.__trialFixture.calls.length,2)
 delete globalThis.__trialFixture
})
