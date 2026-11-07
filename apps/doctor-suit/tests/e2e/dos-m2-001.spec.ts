import {test,actualCase} from './clinical-actual-fixture'
test('DOS-M2-001: explicit synthetic engineering boundary',async({browser})=>{test.setTimeout(120000);await actualCase(1,browser)})
