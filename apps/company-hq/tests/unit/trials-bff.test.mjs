/** Isolated transport contract; no Auth provider, database or model requests. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
registerHooks({ resolve(specifier,context,nextResolve) {
  if(specifier==='h3')return{url:'data:text/javascript,'+encodeURIComponent(`export const createError=x=>Object.assign(new Error(x.statusMessage),x);export const getHeader=(event,key)=>event.node.req.headers[key];export const setResponseHeader=(event,key,value)=>event.node.res.setHeader(key,value)`),shortCircuit:true}
  if (context.parentURL?.includes('/server/api/hq/trials.') && specifier==='../../utils/hqAccess') {
    return {url:'data:text/javascript,'+encodeURIComponent(`export async function requireHqFounder(){if(!globalThis.__trialFixture.authorized)throw Object.assign(new Error('denied'),{statusCode:403});return{accessToken:'synthetic-token'}};export async function hqRpc(config,token,name,args){globalThis.__trialFixture.calls.push({name,args});return{accepted:true}}`),shortCircuit:true}
  }
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes('/apps/company-hq/')) return nextResolve(specifier+'.ts',context)
  return nextResolve(specifier,context)
}})
globalThis.defineEventHandler=fn=>fn
globalThis.useRuntimeConfig=()=>({})
const {default:post}=await import('../../server/api/hq/trials.post.ts')
const {default:get}=await import('../../server/api/hq/trials.get.ts')
function event(body,headers={}) {
 const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.headers={'content-type':'application/json',...headers}
 return {node:{req,res:{setHeader(){}}}}
}
test('trial BFF requires founder access and accepts only qualification commands',async()=>{
 globalThis.__trialFixture={authorized:false,calls:[]}
 const start={agentId:'AG-HR-002',skillFileId:'synthetic_skill_01',requestKey:randomUUID()}
 await assert.rejects(()=>post(event(start)),error=>error.statusCode===403)
 await assert.rejects(()=>get(event(null)),error=>error.statusCode===403)
 assert.deepEqual(globalThis.__trialFixture.calls,[])
 globalThis.__trialFixture.authorized=true
 await assert.rejects(()=>post(event(start)),error=>error.statusCode===400)
 assert.deepEqual(globalThis.__trialFixture.calls,[])
 const trialId=randomUUID();await post(event({trialId}))
 assert.deepEqual(globalThis.__trialFixture.calls[0],{name:'hq_issue_workforce_qualification',args:{p_trial_id:trialId}})
 for(const body of [{trialId,workerId:randomUUID()},{trialId:'invalid'},{agentId:'AG-HR-002'}]) await assert.rejects(()=>post(event(body)),error=>error.statusCode===400)
 await assert.rejects(()=>post(event({trialId},{'content-length':'99999'})),error=>error.statusCode===400)
 await get(event(null));assert.equal(globalThis.__trialFixture.calls.at(-1).name,'hq_workforce_trial_status')
 assert.equal(globalThis.__trialFixture.calls.length,2)
 delete globalThis.__trialFixture
})
