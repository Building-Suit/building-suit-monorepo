import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSicsWeight, parseSicsIdentity, parseSicsCapability, sicsNetReading } from '../src/utils/mtSics.js'
const frame = (id, state, value, unit = 'kg') => `${id} ${state} ${value.padStart(10, ' ')} ${unit}\r\n`
test('MT-SICS preserves actual host units and stable net/tare/gross without numeric rounding', () => {
  const before = frame('TA','A','0.125'), stable = frame('S','S','0.250'), after = frame('TA','A','0.125000')
  assert.deepEqual(sicsNetReading(before, stable, after), { net:'0.25',tare:'0.125',gross:'0.375',unit:'kg',tareBefore:before,stable,tareAfter:after })
  assert.equal(parseSicsWeight(frame('T','S','25','g'),'T').value,'25')
  assert.equal(parseSicsWeight(frame('S','S','0.000001','g'),'S').value,'0.000001')
})
test('MT-SICS rejects unstable, overload, tare drift, changed units and malformed readings', () => {
  for (const [raw, code] of [[frame('S','D','2'),'SCALE_UNSTABLE'],['S +\r\n','SCALE_OVERLOAD'],['S -\r\n','SCALE_UNDERLOAD'],['S I\r\n','SCALE_NOT_READY'],['ET\r\n','SCALE_DEVICE_ERROR'],[frame('S','S','1','lb'),'SCALE_UNSUPPORTED_UNIT'],['S S 123 kg\r\n','SCALE_UNEXPECTED_RESPONSE'],['S S       1.00 kg\n','SCALE_INVALID_FRAME'],[frame('S','S','0.0000001'),'SCALE_UNSUPPORTED_PRECISION']]) assert.throws(()=>parseSicsWeight(raw,'S'),new RegExp(code))
  assert.throws(()=>sicsNetReading(frame('TA','A','1'),frame('S','S','2'),frame('TA','A','2')),/SCALE_TARE_CHANGED/)
  assert.throws(()=>sicsNetReading(frame('TA','A','1'),frame('S','S','2','g'),frame('TA','A','1')),/SCALE_UNIT_CHANGED/)
  for (const value of ['0','-0.1']) assert.throws(()=>sicsNetReading(frame('TA','A','0'),frame('S','S',value),frame('TA','A','0')),/SCALE_INVALID_NET/)
  assert.throws(()=>sicsNetReading(frame('TA','A','-1'),frame('S','S','2'),frame('TA','A','-1')),/SCALE_INVALID_NET/)
})
test('MT-SICS probes identity and bounded command-list responses without changing device settings', () => {
  assert.equal(parseSicsIdentity('I4 A "TEST-SCALE-001"\r\n'),'TEST-SCALE-001')
  assert.deepEqual(parseSicsCapability('I0 B 0 "S"\r\n'),{ final:false,level:0,command:'S' })
  assert.deepEqual(parseSicsCapability('I0 A 1 "TA"\r\n'),{ final:true,level:1,command:'TA' })
  for (const raw of ['I4 A ""\r\n','I4 A "x"\r\nS S       1.00 kg\r\n','I4 A "x\\y"\r\n']) assert.throws(()=>parseSicsIdentity(raw))
  assert.throws(()=>parseSicsCapability('I0 B 9 "S"\r\n'))
})
