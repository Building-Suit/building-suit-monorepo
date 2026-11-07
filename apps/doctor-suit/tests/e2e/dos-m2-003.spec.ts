import {test,actualCase} from './clinical-actual-fixture'
test('DOS-M2-003: actual delegated intake fidelity',async({browser})=>{test.setTimeout(120000);await actualCase(3,browser)})
