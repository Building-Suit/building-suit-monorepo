import {test,actualCase} from './clinical-actual-fixture'
test('DOS-M2-009: actual immutable print and explicit recipient release',async({browser})=>{test.setTimeout(120000);await actualCase(9,browser)})
