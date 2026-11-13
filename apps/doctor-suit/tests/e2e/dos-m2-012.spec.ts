import {test,actualCase} from './clinical-actual-fixture'
test('DOS-M2-012: actual isolated recipient view and byte download',async({browser})=>{test.setTimeout(120000);await actualCase(12,browser)})
