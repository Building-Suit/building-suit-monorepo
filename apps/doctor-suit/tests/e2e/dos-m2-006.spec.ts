import {test,actualCase} from './clinical-actual-fixture'
test('DOS-M2-006: actual explicit prescription editor fidelity',async({browser})=>{test.setTimeout(120000);await actualCase(6,browser)})
