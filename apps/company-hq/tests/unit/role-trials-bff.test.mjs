/** Generated requests only. Founder guard and exact transport schemas, no live calls. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
import {Readable} from 'node:stream'
import {randomUUID} from 'node:crypto'
registerHooks({resolve(specifier,context,next){
 if(specifier==='h3')return{url:'data:text/javascript,'+encodeURIComponent(`export const createError=x=>Object.assign(new Error(x.statusMessage),x);export const getHeader=(e,k)=>e.node.req.headers[k];export const setResponseHeader=(e,k,v)=>e.node.res.setHeader(k,v)`),shortCircuit:true}
 if(context.parentURL?.includes('/server/api/hq/')&&/utils\/hqAccess$/.test(specifier))return{url:'data:text/javascript,'+encodeURIComponent(`export async function requireHqFounder(){if(!globalThis.__roleTrial.authorized)throw Object.assign(new Error('denied'),{statusCode:403});return{accessToken:'synthetic'}};export async function hqRpc(c,t,name,args){globalThis.__roleTrial.calls.push({name,args});return{accepted:true}}`),shortCircuit:true}
 if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier)&&context.parentURL?.includes('/apps/company-hq/'))return next(specifier+'.ts',context)
 return next(specifier,context)
}})
globalThis.defineEventHandler=x=>x;globalThis.useRuntimeConfig=()=>({})
const {default:ordinary}=await import('../../server/api/hq/trials/start.post.ts')
const {default:evaluator}=await import('../../server/api/hq/evaluator-trials/index.post.ts')
const {default:retail}=await import('../../server/api/hq/retail-trials/index.post.ts')
const {default:qualify}=await import('../../server/api/hq/retail-trials/qualification.post.ts')
function event(body,headers={}){const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.headers={'content-type':'application/json',...headers};return{node:{req,res:{setHeader(){}}}}}
test('ordinary, fixed evaluator and finite retail commands require founder and exact bounded inputs',async()=>{
 const skillFileId='generated_skill_001',requestKey=randomUUID(),trialId=randomUUID(),agentId='AG-SOC-002'
 const cases=[[ordinary,{agentId,skillFileId,requestKey},'hq_begin_supervised_worker_trial',{p_agent_id:agentId,p_skill_file_id:skillFileId,p_request_key:requestKey}],
 [evaluator,{skillFileId,requestKey},'hq_begin_evaluator_trial',{p_skill_file_id:skillFileId,p_request_key:requestKey}],
 [retail,{skillFileId,requestKey,category:'clothing'},'hq_begin_public_retail_trial',{p_skill_file_id:skillFileId,p_category:'clothing',p_request_key:requestKey}],
 [qualify,{trialId},'hq_issue_public_retail_qualification',{p_trial_id:trialId}]]
 globalThis.__roleTrial={authorized:false,calls:[]}
 for(const[handler,body]of cases)await assert.rejects(()=>handler(event(body)),e=>e.statusCode===403)
 assert.equal(globalThis.__roleTrial.calls.length,0);globalThis.__roleTrial.authorized=true
 for(const[handler,body,name,args]of cases){await handler(event(body));assert.deepEqual(globalThis.__roleTrial.calls.at(-1),{name,args})}
 for(const[handler,body]of cases){for(const extra of [{reviewerId:'AG-CEO-001'},{model:'gpt-6-luna'},{url:'https://example.org'},{query:'private task text'}])await assert.rejects(()=>handler(event({...body,...extra})),e=>e.statusCode===400)}
 for(const category of [['clothing'],{category:'clothing'},null,'pharmacy','clothing private instructions'])await assert.rejects(()=>retail(event({skillFileId,requestKey,category})),e=>e.statusCode===400)
 for(const category of ['footwear','homewares'])await retail(event({skillFileId,requestKey,category}))
 await assert.rejects(()=>ordinary(event({agentId:'arbitrary',skillFileId,requestKey})),e=>e.statusCode===400)
 await assert.rejects(()=>evaluator(event({skillFileId,requestKey,agentId:'AG-HR-002'})),e=>e.statusCode===400)
 await assert.rejects(()=>retail(event({skillFileId,requestKey,category:'clothing'},{'content-length':'99999'})),e=>e.statusCode===400)
 assert.equal(globalThis.__roleTrial.calls.length,6);delete globalThis.__roleTrial
})
