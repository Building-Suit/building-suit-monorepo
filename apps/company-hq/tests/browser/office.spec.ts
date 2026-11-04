import { test, expect } from '@playwright/test'
import { request as httpRequest } from 'node:http'
const origin='http://127.0.0.1:4337'
const ceo='synthetic-ceo-token-'.repeat(3),hr='synthetic-hr-token-'.repeat(3)
async function login(page: import('@playwright/test').Page) {
  await page.goto('/auth/login');await page.getByRole('textbox',{name:'Password',exact:true}).fill('synthetic-browser-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible()
}
test('HTTP guards, split Arabic payload, oversized body, idempotency and private HR projection',async({request})=>{
 const login=await request.post('/api/hq/auth/login',{headers:{Origin:origin},data:{password:'synthetic-browser-password'}});expect(login.ok()).toBe(true)
 const cookie=login.headers()['set-cookie']!.split(';')[0]!
 expect((await request.post('/api/hq/action',{headers:{Cookie:cookie,Origin:'https://evil.example'},data:{}})).status()).toBe(403)
 expect((await request.post('/api/hq/action',{headers:{Cookie:cookie,Origin:origin},data:{action:'send_message',agent:'hr',text:'No',idempotencyKey:'forged'}})).status()).toBe(403)
 const text='مرحبا بالمدير التنفيذي';const body=Buffer.from(JSON.stringify({action:'send_message',text,idempotencyKey:'arabic-split'}));const split=body.indexOf(Buffer.from('مرحبا'))+1
 const status=await new Promise<number>((resolve,reject)=>{const req=httpRequest(origin+'/api/hq/action',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!))});req.on('error',reject);req.write(body.subarray(0,split));setTimeout(()=>req.end(body.subarray(split)),15)})
 expect(status).toBe(200);const state=await(await request.get('/api/hq/state',{headers:{Cookie:cookie}})).json();expect(state.state.messages.some((m:{text:string})=>m.text===text)).toBe(true)
 expect((await request.post('/api/hq/auth/login',{headers:{Origin:origin},data:{password:'x'.repeat(41_000)}})).status()).toBe(413)
})
test('MCP bridge exposes fixed-role tools, CEO proposals and founder-only approval',async({request})=>{
 const call=async(token:string,method:string,params:Record<string,unknown>={})=>request.post('/api/mcp',{headers:{Authorization:'Bearer '+token},data:{jsonrpc:'2.0',id:1,method,params}})
 const init=await call(ceo,'initialize');expect((await init.json()).result.serverInfo.name).toBe('building-suit-company-hq')
 const ceoTools=(await(await call(ceo,'tools/list')).json()).result.tools.map((t:{name:string})=>t.name)
 expect(ceoTools).toContain('hq_reply');expect(ceoTools).toContain('hq_propose_task');expect(ceoTools).not.toContain('approve_task')
 const hrTools=(await(await call(hr,'tools/list')).json()).result.tools.map((t:{name:string})=>t.name)
 expect(hrTools).not.toContain('hq_reply');expect(hrTools).not.toContain('hq_propose_task');expect(hrTools).toContain('hq_report')
 const proposal=await call(ceo,'tools/call',{name:'hq_propose_task',arguments:{requestKey:'mcp-proposal',title:'Plan from CEO bridge',brief:'Synthetic bounded work',acceptance:'Report and independent review',allowedActions:'Read only'}})
 expect((await proposal.json()).result.isError).toBeUndefined()
 const rejected=await call(ceo,'tools/call',{name:'approve_task',arguments:{}});expect((await rejected.json()).error.code).toBe(-32602)
 const forbidden=await call(hr,'tools/call',{name:'hq_reply',arguments:{requestKey:'forged-reply',text:'No'}});expect((await forbidden.json()).error.code).toBe(-32602)
})
test('workflow scope requires founder session and exact approved public inputs; authorization does not activate a worker',async({page,request})=>{
 await login(page)
 const command=async(body:Record<string,unknown>)=>page.request.post('/api/hq/action',{headers:{Origin:origin},data:{idempotencyKey:crypto.randomUUID(),...body}})
 const proposed=await command({action:'create_task',title:'Synthetic workflow approval',brief:'Read synthetic evidence only',acceptance:'Independent review',allowedActions:'Approved read-only scope'})
 const {id}=await proposed.json();expect((await command({action:'approve_task',id})).ok()).toBe(true)
 const keys=['AG-CEO-001','AG-HR-001','AG-HR-002','AG-HR-003','playbook','bootstrap','charter','workingAgreement','registry','organization','hrCharter','workforceSkill','home','soul','milestones','mode']
 const scope={action:'authorize_workflow',id,allowedTools:['public.search'],publicInputs:['Synthetic query'],brainFiles:Object.fromEntries(keys.map(k=>[k,'synthetic-'+k])),daily:false,timezoneConfirmed:false}
 expect((await request.post('/api/hq/action',{headers:{Origin:origin,Authorization:'Bearer '+ceo},data:{...scope,idempotencyKey:'not-founder'}})).status()).toBe(401)
 expect((await command({...scope,allowedTools:['send.email']})).status()).toBe(422)
 expect((await command({...scope,daily:true})).status()).toBe(422)
 expect((await command(scope)).ok()).toBe(true)
 const state=(await(await page.request.get('/api/hq/state')).json()).state
 expect(state.tasks.find((t:{id:string})=>t.id===id).status).toBe('queued')
 expect(state.workforce.map((w:{name:string})=>w.name)).toEqual(['Steve','Maya','Noah','Iris'])
 expect(state.workflowRuns).toEqual([])
 expect((await command({action:'cancel_task',id})).ok()).toBe(true)
})
