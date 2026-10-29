import test from 'node:test'
import assert from 'node:assert/strict'
import { scaleStockQuantity, verifyScaleCapture } from '../../app/utils/scaleMeasurement.js'
const cable = { id:'cable',itemType:'product',measurement:{baseUnitCode:'m',increment:'0.001',revision:3} }
const factor = { id:'factor-1',revision:2,active:true,productId:'cable',baseUnitCode:'m',measurementRevision:3,kgPerBaseUnit:'0.2' }
test('approved product mass/length is exact and keeps ordinary mass conversions', () => {
  assert.equal(scaleStockQuantity('250','g',cable,factor),'1.25')
  assert.equal(scaleStockQuantity('0.250','kg',cable,factor),'1.25')
  assert.equal(scaleStockQuantity('0.000001','g',cable,{...factor,kgPerBaseUnit:'0.000001'}),'0.001')
  assert.equal(scaleStockQuantity('250','g',{id:'copper',itemType:'product',measurement:{baseUnitCode:'kg',increment:'0.001',revision:1}}),'0.25')
})
test('mass/length rejects absent, stale, cross-product, nonrepresentable and universal conversions', () => {
  for (const invalid of [null,{...factor,active:false},{...factor,productId:'different'},{...factor,measurementRevision:2},{...factor,baseUnitCode:'cm'}]) assert.throws(()=>scaleStockQuantity('250','g',cable,invalid),/APPROVED_MASS_LENGTH_REQUIRED/)
  assert.throws(()=>scaleStockQuantity('250','g',cable,{...factor,kgPerBaseUnit:'0.3'}),/UNREPRESENTABLE/)
  assert.throws(()=>scaleStockQuantity('250','g',{...cable,measurement:{...cable.measurement,increment:'0.1'}},factor),/INVALID_MEASUREMENT_INCREMENT/)
  assert.throws(()=>scaleStockQuantity('250','g',{...cable,measurement:{...cable.measurement,reelTracking:true}},factor),/SCALE_PRODUCT_UNAVAILABLE/)
  assert.throws(()=>scaleStockQuantity('250','g',{...cable,measurement:{...cable.measurement,baseUnitCode:'ea'}},factor),/APPROVED_MASS_LENGTH_REQUIRED/)
  assert.throws(()=>scaleStockQuantity('1','m',cable,factor),/SCALE_PRODUCT_UNAVAILABLE/)
  for (const bad of ['0','-1','0.0000000000001','1000000.000000000001']) assert.throws(()=>scaleStockQuantity('250','g',cable,{...factor,kgPerBaseUnit:bad}),/INVALID_MASS_LENGTH_FACTOR/)
})

const frame = (id,status,value) => `${id} ${status} ${value.padStart(10,' ')} kg\r\n`
function captured() {
  const reading = { confirmed:true,serial:'TEST-001',tareBefore:frame('TA','A','0.125'),stable:frame('S','S','0.250'),tareAfter:frame('TA','A','0.125') }
  return { id:'capture-1',item:cable,quantity:'1.25',unitCode:'m',availableQuantity:'5',snapshot:{id:'capture-1',kind:'scale',productId:'cable',productRevision:3,baseQuantity:'1.25',baseUnitCode:'m',netQuantity:'0.25',tareQuantity:'0.125',grossQuantity:'0.375',unitCode:'kg',reading,device:{serial:'TEST-001'},factor} }
}
test('capture reader validates raw evidence and exact product quantity before cart projection', () => {
  const valid = captured()
  assert.equal(verifyScaleCapture(valid),valid)
  const changes = [
    value=>{value.quantity='1.250001'},
    value=>{value.snapshot.grossQuantity='0.376'},
    value=>{value.snapshot.reading.confirmed=false},
    value=>{value.snapshot.reading.serial='OTHER'},
    value=>{value.snapshot.productRevision=2},
    value=>{value.snapshot.baseUnitCode='cm'},
    value=>{value.availableQuantity=5},
    value=>{value.snapshot.reading.stable=frame('S','D','0.250')},
    value=>{value.snapshot.reading.tareAfter=frame('TA','A','0.126')},
    value=>{value.snapshot.factor={...factor,kgPerBaseUnit:'0.25'}},
  ]
  for (const change of changes) { const bad=structuredClone(valid);change(bad);assert.throws(()=>verifyScaleCapture(bad)) }
  assert.equal(verifyScaleCapture(valid),valid)
})
