import {healthQuery} from './dot-health-collector.mjs'
import {recoveryErrorEnvelope} from './recovery-error.mjs'
import {fileURLToPath} from 'node:url'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export function resolveOperatorCommand(args,env=process.env,query=healthQuery) {
 const [run,gate,response,actor]=args
 if(args.length!==4||!uuid.test(run??'')||!uuid.test(actor??'')||!/^[a-f0-9]{32}$/.test(gate??'')||!['approve','reject','revoke'].includes(response))throw Error('authenticated_operator_command_required')
 if(!env.BS_OPERATOR_DB_USER)throw Error('dedicated_operator_credentials_required')
 const routed={...env,BS_CONTROL_DB_USER:env.BS_OPERATOR_DB_USER}
 // Each argument is constrained before constructing SQL; actor originates in the
 // authenticated n8n form, delivered over a dedicated forced SSH capability.
 return query(`SELECT control.resolve_authenticated_operator_gate('${actor}'::uuid,'${run}'::uuid,'${gate}','${response}');`,routed)
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(resolveOperatorCommand(process.argv.slice(2))))}
 catch(error){console.log(JSON.stringify(recoveryErrorEnvelope(error,'operator-gate')));process.exitCode=1}
}
