import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source=new URL('../../config/introductory-plans.v2.json',import.meta.url)
const catalog=JSON.parse(readFileSync(source,'utf8'))
const migration=readFileSync(new URL('../../supabase/migrations/20261018154514_doctor_annual_discount_32.sql',import.meta.url),'utf8')
test('authorized launch prices and owner-inclusive limits remain exact across commercial source and database catalog',()=>{
 assert.equal(catalog.published,true);assert.equal(catalog.decisionStatus,'owner_authorized_launch_prices');assert.equal(catalog.currency,'EGP');assert.equal(catalog.currencyExponent,2)
 assert.deepEqual(catalog.plans.map(p=>[p.key,p.monthlyMinor,p.yearlyMinor,p.clinicLimit,p.totalNamedUsers,p.staffLimitExcludingOwner]),[
  ['starter',29900,243984,1,5,4],['clinic',59900,488784,3,10,9],['group',99900,815184,5,25,24]])
 for(const p of catalog.plans){
  assert.equal(p.staffLimitExcludingOwner+1,p.totalNamedUsers)
  assert.equal(BigInt(p.yearlyMinor)*100n,BigInt(p.monthlyMinor)*12n*68n)
  assert.ok(migration.includes('monthly_minor*12*68/100'))
 }
})
test('annual pricing means twelve calendar months at exactly thirty-two percent saving, without changing trial or claiming tax treatment',()=>{
 assert.equal(catalog.annualCalendarMonths,12);assert.equal(catalog.annualDiscountPercent,32)
 assert.equal(catalog.selfServiceSetupFeeMinor,0)
 for(const p of catalog.plans){assert.equal('trialDays'in p,false);assert.equal('unlimitedStorage'in p,false)}
 assert.equal('trialDays'in catalog,false)
})

test('the superseded catalogue is retained as historical evidence',()=>{
 const legacy=JSON.parse(readFileSync(new URL('../../config/introductory-plans.v1.json',import.meta.url),'utf8'))
 assert.deepEqual(legacy.plans.map(p=>p.yearlyMinor),[299000,599000,999000])
 assert.equal(legacy.annualMonthlyPayments,10)
})
