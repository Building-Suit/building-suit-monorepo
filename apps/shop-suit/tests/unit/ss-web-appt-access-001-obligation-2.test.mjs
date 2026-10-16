import assert from 'node:assert/strict'
import test from 'node:test'
import {normalizeAppointmentAccessPhone,parseAppointmentAccessStatus,parseAppointmentAccessSession} from '../../shared/appointmentAccess.ts'
test('normalized phone handles formatting and Arabic digits without guessing a country',()=>{
 for(const raw of ['+20 (100) 000-0002','0020 100 000 0002','+٢٠ ١٠٠ ٠٠٠ ٠٠٠٢','+۲۰ ۱۰۰ ۰۰۰ ۰۰۰۲'])assert.equal(normalizeAppointmentAccessPhone(raw),'201000000002')
 assert.equal(normalizeAppointmentAccessPhone('010 0000 0000'),'01000000000');assert.notEqual(normalizeAppointmentAccessPhone('01000000000'),normalizeAppointmentAccessPhone('+201000000000'))
 for(const raw of [null,123,'+123','1'.repeat(16),'1'.repeat(41),'01abc0000000','javascript:1234567','+20;12345678'])assert.equal(normalizeAppointmentAccessPhone(raw),null)
})
test('staff status and session adapters allowlist outputs; session data contains no customer history',()=>{
 const now=Date.parse('2026-10-16T00:00:00Z'),token='x'.repeat(43),expiresAt=new Date(now+599000).toISOString()
 assert.deepEqual(parseAppointmentAccessSession({ok:true,token,expiresAt,customerId:'PRIVATE',notes:'PRIVATE',financials:999},now),{ok:true,token,expiresAt})
 for(const patch of [{ok:false},{token:'short'},{token:'+'.repeat(43)},{expiresAt:'invalid'},{expiresAt:new Date(now-1).toISOString()},{expiresAt:new Date(now+600001).toISOString()}])assert.equal(parseAppointmentAccessSession({ok:true,token,expiresAt,...patch},now),null)
 assert.deepEqual(parseAppointmentAccessStatus({enabled:false,usablePhone:false,issuedAt:null,code:'PRIVATE'}),{enabled:false,usablePhone:false,issuedAt:null})
 assert.throws(()=>parseAppointmentAccessStatus({enabled:true,usablePhone:'yes',issuedAt:null}))
})
