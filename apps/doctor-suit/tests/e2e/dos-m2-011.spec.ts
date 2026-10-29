import {test,actualCase} from './clinical-actual-fixture'
test('DOS-M2-011: actual private result upload and linkage',async({browser})=>{test.setTimeout(120000);await actualCase(11,browser)})
