import {test,actualCase} from './clinical-actual-fixture'
test('DOS-M2-005: no inferred medicine provenance or defaults',async({browser})=>{test.setTimeout(120000);await actualCase(5,browser)})
