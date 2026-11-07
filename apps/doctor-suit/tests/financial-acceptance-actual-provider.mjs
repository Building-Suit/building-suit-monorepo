// Invoked only inside the existing owned disposable actual-provider lifecycle, after real financial GUI assertions.
import { execFileSync } from 'node:child_process'
import { practiceFinancialReportRepository } from '../app/utils/practiceFinancialReportRepository.ts'
import { practiceMoneyRepository } from '../app/utils/practiceMoneyRepository.ts'
import { reconcileSyntheticPracticeFinancials } from './financial-acceptance-review.mjs'
export async function verifyFinancialAcceptanceSources({root,a,rpc,originalPeriod,setStage}){
 setStage('actual financial acceptance full-population source reconciliation')
 const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();if(!/^[a-f0-9]{40}$/.test(source))throw Error('Financial acceptance source binding required')
 const reports=practiceFinancialReportRepository(a.client),money=practiceMoneyRepository(a.client),scope={userId:a.user.id,practiceId:a.scope.practiceId,locationId:null},signal=AbortSignal.timeout(30000)
 const query={from:null,until:null,status:'all',metric:'charges',currency:null,exponent:null,page:1},first=await reports.read(scope,query,signal),contributions=[...first.items]
 if(first.total<2||first.total>25000)throw Error('Owned financial acceptance population invalid')
 for(let page=2;contributions.length<first.total;page++){if(page>1000)throw Error('Financial source paging exceeded bound');const next=await reports.read(scope,{...query,page},signal);if(next.total!==first.total||JSON.stringify(next.totals)!==JSON.stringify(first.totals)||!next.items.length)throw Error('Financial report population changed during acceptance');contributions.push(...next.items)}
 if(contributions.length!==first.total)throw Error('Financial report source population incomplete')
 const charges=[]
 for(const c of contributions){const q={userId:scope.userId,practiceId:scope.practiceId,locationId:c.locationId,chargeId:c.chargeId},read=await money.read(q,1,signal),items=[...read.model.items],m=read.model
  if(m.total>20000||m.chargeVersionId!==c.id||m.chargeMinor!==c.contribution||m.currency!==c.currency||m.exponent!==c.exponent)throw Error('Financial charge source changed during acceptance')
  for(let page=2;items.length<m.total;page++){if(page>1000)throw Error('Financial request paging exceeded bound');const next=await money.read(q,page,signal);if(next.model.total!==m.total||next.model.chargeVersionId!==m.chargeVersionId||JSON.stringify(next.model.balance)!==JSON.stringify(m.balance)||!next.model.items.length)throw Error('Financial request population changed during acceptance');items.push(...next.model.items)}
  charges.push({scope:read.scope,model:{...m,items}})
 }
 const totals=reconcileSyntheticPracticeFinancials(first.totals,charges,scope)
 if(totals.charge_count<2||totals.entry_count<4||totals.unknown_count!==0)throw Error('Financial end-to-end sources incomplete or unresolved')
 const subscription=await rpc(a.client,'doctor_saas_status')
 if(subscription.state!=='paid'||subscription.live_activation!==false||subscription.period.id!==originalPeriod.id||subscription.period.ends_at!==originalPeriod.ends_at)throw Error('Practice reconciliation changed SaaS subscription authority')
 console.log(JSON.stringify({kind:'doctor-financial-acceptance/v1',task:'DOS-M6-010',source_head:source,status:'passed-synthetic-cross-ledger-source-reconciliation',...totals,full_task_acceptance:false,accountable_review:'unavailable',commercial_launch:'unapproved'}))
}
