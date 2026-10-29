import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGs1WeightBarcode, capturedWeightQuantity, cartQuantityFromDecimal, assertCapturedStock } from '../../app/utils/weightBarcodes.js'
import { cartLineKey, saleLineInput } from '../../app/utils/pos.js'
const gtin='94000000000009'
test('verified GS1 element strings preserve exact net kilograms and GTIN identity',()=>{
 for(let n=0;n<=5;n++)for(const wrap of ['raw','aim','hri']){
  const payload=wrap==='hri'?`(01)${gtin}(310${n})000250`:`${wrap==='aim'?']C1':''}01${gtin}310${n}000250`
  const result=parseGs1WeightBarcode(payload)
  assert.equal(result.gtin,gtin);assert.equal(result.netQuantity,['250','25','2.5','0.25','0.025','0.0025'][n]);assert.equal(result.unitCode,'kg')
 }
 assert.equal(parseGs1WeightBarcode(`(01)${gtin}(3105)000001`).netQuantity,'0.00001')
})
test('ordinary codes and unverified/ambiguous national, price and extra-field formats are not decoded',()=>{
 for(const code of ['1234567890123','2712340002252',`01${gtin}3106000250`,`01${gtin}310300025017261231`,`(3103)000250(01)${gtin}`,`(01)${gtin}(3932)000250`,`]C1(01)${gtin}(3103)000250`,`\u00a001${gtin}3103000250`, '9'.repeat(81)])assert.equal(parseGs1WeightBarcode(code),null)
 for(const code of [`01${gtin.slice(0,-1)}83103000250`,`01${gtin}3103000000`,`01040000000000073103000250`])assert.throws(()=>parseGs1WeightBarcode(code),/INVALID_WEIGHT_BARCODE/)
})
test('capture conversion respects stock units, product increments, bounded cart transport and identity',()=>{
 const parsed=parseGs1WeightBarcode(`(01)${gtin}(3103)000250`),item={itemType:'product',barcode:gtin,measurement:{baseUnitCode:'g',increment:'0.001'}}
 assert.equal(capturedWeightQuantity(parsed,item),'250')
 assert.equal(capturedWeightQuantity(parsed,{...item,measurement:{baseUnitCode:'kg',increment:'0.001'}}),'0.25')
 assert.throws(()=>capturedWeightQuantity(parsed,{...item,measurement:{baseUnitCode:'kg',increment:'0.1'}}),/INVALID_MEASUREMENT_INCREMENT/)
 assert.throws(()=>capturedWeightQuantity(parsed,{...item,barcode:'different'}),/PRODUCT_UNAVAILABLE/)
 assert.throws(()=>capturedWeightQuantity(parsed,{...item,measurement:{baseUnitCode:'m',increment:'0.001'}}),/PRODUCT_UNAVAILABLE/)
 for(const quantity of ['0.000001','0.275001','999999.999999','1000000'])assert.equal(String(cartQuantityFromDecimal(quantity)),quantity)
 for(const quantity of ['0','-1','1000000.000001','0.0000001','NaN'])assert.throws(()=>cartQuantityFromDecimal(quantity),/INVALID_CAPTURED_QUANTITY/)
})

test('separate label identities retain their source and share canonical SKU capacity',()=>{
 const item={id:'copper',itemType:'product',barcode:gtin,measurement:{baseUnitCode:'kg',increment:'0.001'},unitSelection:'unit:kg'}
 const captured={...item,sourceId:'copper',quantity:0.25,measurementCapture:{id:'label-1',kind:'gs1',raw:`(01)${gtin}(3103)000250`}}
 assert.notEqual(cartLineKey(captured),cartLineKey({...captured,measurementCapture:{...captured.measurementCapture,id:'label-2'}}))
 assert.deepEqual(saleLineInput(captured).measurement_capture,captured.measurementCapture)
 const grams={...item,sourceId:'copper',quantity:250,unitSelection:'unit:g'}
 assert.doesNotThrow(()=>assertCapturedStock([captured,grams],item,'0.25','0.75'))
 assert.throws(()=>assertCapturedStock([captured,grams],item,'0.250001','0.75'),/INSUFFICIENT_STOCK/)
})
