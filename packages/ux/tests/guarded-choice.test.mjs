import test from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { useGuardedChoice } from '../src/composables/useGuardedChoice.ts'
test('guarded choices retain a cancelled value and prevent duplicate pending changes', async () => {
 const value=ref('EGP');let release
 const controller=useGuardedChoice(value,['EGP','USD'],()=>new Promise(resolve=>{release=resolve}))
 const changing=controller.choose('USD')
 assert.equal(controller.pending.value,true)
 assert.equal(await controller.choose('USD'),false)
 assert.equal(value.value,'EGP')
 release(false);assert.equal(await changing,false);assert.equal(value.value,'EGP')
 const next=controller.choose('USD');release(true);assert.equal(await next,true);assert.equal(value.value,'USD')
 assert.equal(await controller.choose('EUR'),false)
 assert.equal(controller.pending.value,false)
})
test('a rejected operation releases pending state and does not change the selection', async () => {
 const value=ref('EGP'),controller=useGuardedChoice(value,['EGP','USD'],async()=>{throw Error('not saved')})
 await assert.rejects(controller.choose('USD'));assert.equal(value.value,'EGP');assert.equal(controller.pending.value,false)
})

test('native radios restore the controlled value when an asynchronous change is declined', async () => {
 const { useControlledRadioGroup } = await import('../src/composables/useControlledRadioGroup.ts')
 const { nextTick, effectScope } = await import('vue')
 const selected=ref('EGP'),inputs=[{value:'EGP',checked:true},{value:'USD',checked:false}],scope=effectScope()
 let controls
 scope.run(()=>{controls=useControlledRadioGroup(()=>selected.value,()=>{});controls.root.value={querySelectorAll:()=>inputs}})
 await nextTick()
 inputs[0].checked=false;inputs[1].checked=true
 controls.choose('USD');await nextTick()
 assert.equal(inputs[0].checked,true);assert.equal(inputs[1].checked,false)
 selected.value='USD';await nextTick()
 assert.equal(inputs[0].checked,false);assert.equal(inputs[1].checked,true)
 scope.stop()
})
