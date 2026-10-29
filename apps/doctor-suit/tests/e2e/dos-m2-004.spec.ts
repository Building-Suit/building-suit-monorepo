import {test,actualCase} from './clinical-actual-fixture'
test('DOS-M2-004: actual literal bilingual note preservation',async({browser})=>{test.setTimeout(120000);await actualCase(4,browser)})
