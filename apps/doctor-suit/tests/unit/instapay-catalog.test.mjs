import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source=new URL('../../config/introductory-plans.v1.json',import.meta.url)
const catalog=JSON.parse(readFileSync(source,'utf8'))
const migration=readFileSync(new URL('../../supabase/migrations/20261018105034_doctor_introductory_plan_catalog.sql',import.meta.url),'utf8')
test('provisional introductory prices and owner-inclusive limits remain exact across commercial source and database catalog',()=>{
 assert.equal(catalog.published,false);assert.equal(catalog.decisionStatus,'provisional_pending_user_comparison');assert.equal(catalog.currency,'EGP');assert.equal(catalog.currencyExponent,2)
 assert.deepEqual(catalog.plans.map(p=>[p.key,p.monthlyMinor,p.yearlyMinor,p.clinicLimit,p.totalNamedUsers,p.staffLimitExcludingOwner]),[
  ['starter',19900,199000,1,5,4],['clinic',39900,399000,3,10,9],['group',69900,699000,5,25,24]])
 for(const p of catalog.plans){
  assert.equal(p.staffLimitExcludingOwner+1,p.totalNamedUsers)
  const row=`('${p.key}','${p.nameEn}','${p.nameAr}',${p.monthlyMinor},${p.yearlyMinor},${p.clinicLimit},${p.totalNamedUsers},${p.staffLimitExcludingOwner})`
  assert.ok(migration.includes(row),`database seed differs from ${p.key} source`)
 }
})
test('annual pricing means twelve calendar months for ten payments, without changing trial or claiming tax treatment',()=>{
 assert.equal(catalog.annualCalendarMonths,12);assert.equal(catalog.annualMonthlyPayments,10)
 assert.equal(catalog.selfServiceSetupFeeMinor,0)
 for(const p of catalog.plans){assert.equal(p.yearlyMinor,p.monthlyMinor*10);assert.equal('trialDays'in p,false);assert.equal('unlimitedStorage'in p,false)}
 assert.equal('trialDays'in catalog,false)
})
