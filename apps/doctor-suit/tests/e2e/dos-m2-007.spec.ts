import {test,actualCase} from './clinical-actual-fixture'
test('DOS-M2-007: actual regimen vectors and rejection',async({browser})=>{test.setTimeout(120000);await actualCase(7,browser)})
