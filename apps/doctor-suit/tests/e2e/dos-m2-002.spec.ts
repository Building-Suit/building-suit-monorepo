import {test,actualCase} from './clinical-actual-fixture'
test('DOS-M2-002: actual UI encounter creation',async({browser})=>{test.setTimeout(120000);await actualCase(2,browser)})
