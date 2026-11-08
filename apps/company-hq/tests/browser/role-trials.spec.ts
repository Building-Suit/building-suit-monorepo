import { expect, test, type Page, type Route } from '@playwright/test'
import { installWorkforceFixture } from './workforce-fixture'

/** Generated HTTP projections only; never submits a live trial or provider call. */
const trialId='71000000-0000-4000-8000-000000000001',taskId='72000000-0000-4000-8000-000000000001'
const names:Record<string,string>={'AG-SALES-002':'Basma Generated','AG-HR-002':'Noah Generated','AG-HR-003':'Iris Generated','AG-RES-002':'Karim Generated'}
const base=()=>({skillFileId:'generated_assigned_skill',eligible:true,qualified:false,trialId:null as string|null,taskId:null as string|null,status:null as string|null,receiptIssued:false,reviewComplete:false,bindingCurrent:true})
async function roles(page:Page){
 const fixture=await installWorkforceFixture(page)
 for(const[index,id]of[[2,'AG-HR-002'],[3,'AG-HR-003'],[5,'AG-SALES-002'],[6,'AG-RES-002']]as const)Object.assign(fixture.snapshot().agents[index]!,{id,name:names[id]})
 const rows=Object.keys(names).map(agentId=>({agentId,...base(),ordinary:{...base(),skillName:'Generated assigned skill',reviewerId:agentId==='AG-HR-003'?'AG-CEO-001':'AG-HR-003',reviewerReady:true},...(agentId==='AG-RES-002'?{publicResearch:base(),publicRetail:{...base(),categories:['clothing','footwear','homewares'],lastCategory:null as string|null,setupRequired:false}}:{})}))
 const posts:{path:string;body:Record<string,unknown>;headers:Record<string,string>}[]=[]
 const handler={reply:async(route:Route)=>{await route.fulfill({status:500,json:{message:'Generated controlled failure'}})}}
 await page.route(url=>['/api/hq/trials','/api/hq/trials/start','/api/hq/evaluator-trials','/api/hq/retail-trials','/api/hq/retail-trials/qualification','/api/hq/research-trials'].includes(url.pathname),async route=>{
  const request=route.request();if(request.method()==='GET')return route.fulfill({json:rows})
  posts.push({path:new URL(request.url()).pathname,body:request.postDataJSON(),headers:request.headers()});await handler.reply(route)
 })
 return{fixture,rows,posts,handler,row:(id:string)=>rows.find(row=>row.agentId===id)!,async open(id:string){
  await fixture.open();await page.getByRole('combobox',{name:'Workplaces',exact:true}).click();await page.getByRole('option',{name:'Fixture department',exact:true}).click();await page.getByRole('button',{name:`Agent details: ${names[id]}`,exact:true}).click();return page.getByRole('complementary',{name:names[id],exact:true})
 },async select(id:string){await page.keyboard.press('Escape');await page.getByRole('button',{name:`Agent details: ${names[id]}`,exact:true}).click();return page.getByRole('complementary',{name:names[id],exact:true})}}
}
for(const agentId of['AG-SALES-002','AG-HR-002'])test(`${names[agentId]} start is confirmed and uncertain retries retain request identity`,async({page})=>{
 const f=await roles(page),panel=await f.open(agentId),start=panel.getByRole('button',{name:'Start assigned-skill trial',exact:true})
 await start.click();await expect(page.getByRole('dialog')).toContainText('No network tools, customer work or external actions');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();expect(f.posts).toHaveLength(0)
 for(let n=0;n<2;n++){await start.click();await page.getByRole('dialog').getByRole('button',{name:'Start trial',exact:true}).click();await expect.poll(()=>f.posts.length).toBe(n+1);await expect(panel).toContainText('Trial action unconfirmed. Refresh before retrying')}
 expect(f.posts[0]!.path).toBe('/api/hq/trials/start');expect(Object.keys(f.posts[0]!.body).sort()).toEqual(['agentId','requestKey','skillFileId']);expect(f.posts[0]!.body).toMatchObject({agentId,skillFileId:'generated_assigned_skill'});expect(f.posts[0]!.body).toEqual(f.posts[1]!.body)
 expect(f.posts[0]!.headers['x-hq-access']).toBe('1');expect(f.posts[0]!.headers['x-hq-brain']).toBe('1');expect(f.fixture.unexpected).toEqual([]);expect(f.fixture.errors).toEqual([])
})
test('Iris uses immutable Steve review, evaluator start, then generic qualification approval',async({page})=>{
 const f=await roles(page),row=f.row('AG-HR-003')
 f.handler.reply=async route=>{if(new URL(route.request().url()).pathname==='/api/hq/evaluator-trials'){Object.assign(row.ordinary,{trialId,taskId,status:'passed',reviewComplete:true,eligible:false});await route.fulfill({json:{accepted:true,trialId,status:'passed'}})}else{row.ordinary.receiptIssued=true;row.ordinary.qualified=true;await route.fulfill({json:{accepted:true}})}}
 const panel=await f.open(row.agentId);await expect(panel).toContainText('Independent reviewer: Steve Fixture');await panel.getByRole('button',{name:'Start assigned-skill trial',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Steve is the fixed independent reviewer for Iris; Iris cannot review herself.');await page.getByRole('dialog').getByRole('button',{name:'Start trial',exact:true}).click()
 await panel.getByRole('button',{name:'Approve assigned-skill qualification',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Approve qualification',exact:true}).click();await expect(panel.getByText('Qualified for bounded drafting',{exact:true})).toBeVisible()
 expect(f.posts.map(post=>post.path)).toEqual(['/api/hq/evaluator-trials','/api/hq/trials']);expect(Object.keys(f.posts[0]!.body).sort()).toEqual(['requestKey','skillFileId']);expect(f.posts[1]!.body).toEqual({trialId});expect(f.fixture.unexpected).toEqual([]);expect(f.fixture.errors).toEqual([])
})
test('retail selection is finite and qualification retains the actual observed category',async({page})=>{
 const f=await roles(page),retail=f.row('AG-RES-002').publicRetail!
 f.handler.reply=async route=>{if(new URL(route.request().url()).pathname==='/api/hq/retail-trials'){Object.assign(retail,{trialId,taskId,status:'passed',reviewComplete:true,eligible:false,lastCategory:'footwear'});await route.fulfill({json:{accepted:true,trialId,status:'passed'}})}else{retail.receiptIssued=true;retail.qualified=true;await route.fulfill({json:{accepted:true}})}}
 const panel=await f.open('AG-RES-002');await panel.getByRole('combobox',{name:'Fixed New Cairo shop category',exact:true}).click();await expect(page.getByRole('option')).toHaveText(['clothing','footwear','homewares']);await page.getByRole('option',{name:'footwear',exact:true}).click();await panel.getByRole('button',{name:'Start Public Retail trial',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('actual observed category remains distinct from unexercised examples');await page.getByRole('dialog').getByRole('button',{name:'Start trial',exact:true}).click()
 await expect(panel).toContainText('Actual latest trial category: footwear. Other category results are not implied.');await panel.getByRole('button',{name:'Approve Public Retail qualification',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Approve qualification',exact:true}).click();await expect(panel.getByRole('button',{name:'Approve Public Retail qualification',exact:true})).toHaveCount(0)
 expect(f.posts.map(post=>post.path)).toEqual(['/api/hq/retail-trials','/api/hq/retail-trials/qualification']);expect(Object.keys(f.posts[0]!.body).sort()).toEqual(['category','requestKey','skillFileId']);expect(f.posts[0]!.body.category).toBe('footwear');expect(f.posts[1]!.body).toEqual({trialId});expect(f.fixture.unexpected).toEqual([]);expect(f.fixture.errors).toEqual([])
})
test('stale ordinary binding during confirmation cannot submit approval',async({page})=>{
 const f=await roles(page),ordinary=f.row('AG-SALES-002').ordinary;Object.assign(ordinary,{trialId,taskId,status:'passed',reviewComplete:true,eligible:false});const panel=await f.open('AG-SALES-002');await panel.getByRole('button',{name:'Approve assigned-skill qualification',exact:true}).click();ordinary.bindingCurrent=false;await f.fixture.publish(f.fixture.snapshot());await expect(panel.getByText('Earlier assigned-skill evidence is not current',{exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Approve qualification',exact:true}).click();expect(f.posts).toHaveLength(0)
})
for(const late of[false,true])test(`Karim feedback stays out of Basma panel${late?' after late completion':''}`,async({page})=>{
 const f=await roles(page),research=f.row('AG-RES-002').publicResearch!;let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve})
 f.handler.reply=async route=>{if(late)await held;Object.assign(research,{trialId,taskId,status:'active',eligible:false});await route.fulfill({json:{accepted:true,trialId,status:'active'}})}
 const karim=await f.open('AG-RES-002');await karim.getByRole('button',{name:'Start Public Research trial',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Start trial',exact:true}).click();await expect.poll(()=>f.posts.length).toBe(1);if(!late)await expect(karim).toContainText('Public Research trial request confirmed.')
 const basma=await f.select('AG-SALES-002');if(late)release();await expect(basma.getByRole('button',{name:'Start assigned-skill trial',exact:true})).toBeEnabled();await expect(basma).not.toContainText('Public Research trial request confirmed.');await expect(basma).not.toContainText('Public Research qualification recorded');expect(f.posts).toHaveLength(1);expect(f.fixture.errors).toEqual([])
})
