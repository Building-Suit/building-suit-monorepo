import { expect, test, type Page } from '@playwright/test'
import { installWorkforceFixture } from './workforce-fixture'

/** Synthetic fixed repository observations only; no external reads or trials. */
const bundleId='81000000-0000-4000-8000-000000000001',trialId='82000000-0000-4000-8000-000000000001'
const predecessorId='83000000-0000-4000-8000-000000000001'
async function setup(page:Page,agentId='AG-DEV-002') {
  const fixture=await installWorkforceFixture(page)
  Object.assign(fixture.snapshot().agents[2]!,{id:agentId,name:'Generated repository worker'})
  const repository={preset:agentId==='AG-DEV-004'?'hq-ci-config-v1':'hq-worker-boundary-v1',skillFileId:'generated_skill_001',freezeEligible:true,eligible:false,qualified:false,reviewerReady:true,
    bundleId:null as string|null,sha:null as string|null,mode:null as string|null,pullRequestNumber:null as number|null,predecessorArtifactId:null as string|null,expiresAt:null as string|null,
    trialId:null as string|null,taskId:null as string|null,status:null as string|null,bindingCurrent:true,receiptIssued:false,reviewComplete:false,budgetRemaining:40}
  const row={agentId,skillFileId:'generated_skill_001',eligible:false,qualified:true,trialId:null,status:null,receiptIssued:true,reviewComplete:true,repository}
  const posts:Record<string,unknown>[]=[]
  await page.route('**/api/hq/trials',route=>route.fulfill({json:[row]}))
  await page.route('**/api/hq/repository-trials',async route=>{
    const body=route.request().postDataJSON();posts.push(body)
    if(body.action==='freeze')Object.assign(repository,{bundleId,sha:body.sha,mode:body.mode,pullRequestNumber:body.pullRequestNumber,predecessorArtifactId:body.predecessorArtifactId,expiresAt:'2030-01-01T00:00:00Z',eligible:true})
    if(body.action==='start')Object.assign(repository,{trialId,taskId:trialId,status:'passed',reviewComplete:true,eligible:false})
    if(body.action==='qualify')Object.assign(repository,{receiptIssued:true,qualified:true})
    await route.fulfill({json:{accepted:true,bundleId,trialId}})
  })
  await fixture.open();await page.getByRole('combobox',{name:'Workplaces',exact:true}).click();await page.getByRole('option',{name:'Fixture department',exact:true}).click();await page.getByRole('button',{name:'Agent details: Generated repository worker',exact:true}).click()
  return {fixture,repository,posts,panel:page.getByRole('complementary',{name:'Generated repository worker',exact:true})}
}
test('founder freezes exact public SHA then separately starts and approves bound repository trial',async({page})=>{
  const f=await setup(page),section=f.panel.getByRole('region',{name:'Public repository trial',exact:true})
  await expect(section).toContainText('frozen historical snapshot, not a claim about the latest staging commit')
  await expect(section.getByRole('textbox',{name:'Public commit SHA',exact:true})).toHaveValue('7614a98ae05d6c1e69ad05f2b35318823d306e8f')
  await section.getByRole('button',{name:'Freeze public repository bundle',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();expect(f.posts).toHaveLength(0)
  await section.getByRole('textbox',{name:'Public commit SHA',exact:true}).fill('b'.repeat(40))
  await section.getByRole('button',{name:'Freeze public repository bundle',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Freeze bundle',exact:true}).click()
  await expect(section.getByRole('button',{name:'Start repository trial',exact:true})).toBeVisible()
  await section.getByRole('button',{name:'Start repository trial',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Adam scopes it first');await page.getByRole('dialog').getByRole('button',{name:'Start trial',exact:true}).click()
  await section.getByRole('button',{name:'Approve repository qualification',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Approve qualification',exact:true}).click()
  await expect(section).toContainText('Repository qualification recorded for the current binding')
  expect(f.posts.map(p=>p.action)).toEqual(['freeze','start','qualify']);expect(f.posts[0]).toMatchObject({agentId:'AG-DEV-002',preset:'hq-worker-boundary-v1',mode:'snapshot',sha:'b'.repeat(40),pullRequestNumber:null,predecessorArtifactId:null})
  expect(f.posts[1]).toMatchObject({agentId:'AG-DEV-002',bundleId});expect(f.posts[2]).toEqual({action:'qualify',trialId});expect(f.fixture.errors).toEqual([]);expect(f.fixture.unexpected).toEqual([])
})
test('Farah requires immutable predecessor artifact and approved PR mode requires positive PR number',async({page})=>{
  const f=await setup(page,'AG-DEV-003'),section=f.panel.getByRole('region',{name:'Public repository trial',exact:true}),freeze=section.getByRole('button',{name:'Freeze public repository bundle',exact:true})
  await expect(freeze).toBeDisabled();await section.getByRole('textbox',{name:'Accepted predecessor artifact ID',exact:true}).fill(predecessorId);await expect(freeze).toBeEnabled()
  await section.getByRole('combobox',{name:'Repository bundle mode',exact:true}).click();await page.getByRole('option',{name:'Approved pull request',exact:true}).click();await expect(freeze).toBeDisabled()
  await section.getByRole('textbox',{name:'Approved pull request number',exact:true}).fill('42');await freeze.click();await page.getByRole('dialog').getByRole('button',{name:'Freeze bundle',exact:true}).click()
  await expect.poll(()=>f.posts.length).toBe(1);expect(f.posts[0]).toMatchObject({agentId:'AG-DEV-003',mode:'approved-pr',pullRequestNumber:42,predecessorArtifactId:predecessorId});expect(f.fixture.errors).toEqual([])
})

test('repository binding changing during confirmation cannot submit qualification',async({page})=>{
  const f=await setup(page)
  Object.assign(f.repository,{bundleId,sha:'a'.repeat(40),mode:'snapshot',expiresAt:'2030-01-01T00:00:00Z',trialId,taskId:trialId,status:'passed',reviewComplete:true})
  await f.fixture.publish(f.fixture.snapshot())
  await f.panel.getByRole('button',{name:'Approve repository qualification',exact:true}).click()
  f.repository.bindingCurrent=false;await f.fixture.publish(f.fixture.snapshot())
  await expect(f.panel.getByRole('button',{name:'Approve repository qualification',exact:true})).toHaveCount(0)
  await page.getByRole('dialog').getByRole('button',{name:'Approve qualification',exact:true}).click()
  expect(f.posts).toHaveLength(0);expect(f.fixture.errors).toEqual([])
})
