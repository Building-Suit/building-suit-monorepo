import {fileURLToPath} from 'node:url'
import {healthQuery} from './dot-health-collector.mjs'

const run='1a75a547-3372-4e2a-b51c-3b1b2bf9ad81'
const quote=value=>"'"+String(value).replaceAll("'","''")+"'"
export function sharedPlanningCommand(args,env=process.env,query=healthQuery){
 const [action,id,...values]=args
 if(id!==run||!env.BS_OPERATOR_DB_USER)throw Error('dedicated_shared_operator_required')
 let sql
 if(action==='repair'&&values.length===2&&/^[a-f0-9]{32}$/.test(values[0])&&values[1].trim().length>=20){
  sql=`SELECT control.repair_shared_future_suit_dependency(${quote(id)}::uuid,${quote(values[0])},${quote(values[1])});`
 }else if(action==='decisions'&&values.length===3&&values[0]==='semantic-prerelease'&&['24','48'].includes(values[1])&&values[2].trim().length>=20){
  sql=`SELECT control.approve_shared_changelog_choices(${quote(id)}::uuid,${quote(values[0])},${Number(values[1])},${quote(values[2])});`
 }else throw Error('explicit_reviewed_shared_planning_arguments_required')
 return query(sql,{...env,BS_CONTROL_DB_USER:env.BS_OPERATOR_DB_USER})
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(sharedPlanningCommand(process.argv.slice(2))))}
 catch(error){console.log(JSON.stringify({ok:false,error:error.message}));process.exitCode=1}
}
