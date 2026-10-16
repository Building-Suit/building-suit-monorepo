import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
const registry=JSON.parse(readFileSync(new URL('../../docs/architecture/environments.json',import.meta.url),'utf8'))
// CI-only configuration operation. Never run by module import or app startup.
export async function configureShopReminderSchedule({environment,enabled,env,fetchImpl=fetch}) {
  if (!['staging','production'].includes(environment) || typeof enabled!=='boolean') throw Error('REMINDER_ENVIRONMENT_INVALID')
  const ref=environment==='staging'?'refs/heads/stg':'refs/heads/main'
  const sha=env('GITHUB_SHA')
  if (env('CI')!=='true' || env('GITHUB_ACTIONS')!=='true' || env('GITHUB_REF')!==ref || env('SHOP_REMINDER_SCHEDULE_APPROVED')!=='true'
    || !/^[a-f0-9]{40}$/.test(sha||'') || env('SHOP_REMINDER_APPROVED_SHA')!==sha) throw Error('REMINDER_CI_APPROVAL_REQUIRED')
  const shop=registry.products['shop-suit']
  const projectRef=shop?.[environment]?.projectRef
  if (!['jvvelvftpfnlogalgxgv','fgdzjnsbcxfbiuogbmom'].includes(projectRef)) throw Error('REMINDER_REGISTRY_BINDING_INVALID')
  const key=env('SHOP_REMINDER_SCHEDULE_SERVICE_ROLE_KEY')
  if (!key || key.length<32) throw Error('REMINDER_SERVER_KEY_REQUIRED')
  let response
  try{response=await fetchImpl(`https://${projectRef}.supabase.co/rest/v1/rpc/shop_appointment_email_schedule`,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json',apikey:key,authorization:`Bearer ${key}`},
    body:JSON.stringify({p_enabled:enabled,p_project_ref:projectRef}),
  })}catch{throw Error('REMINDER_SCHEDULE_TRANSPORT_FAILED')}
  if(!response.ok)throw Error('REMINDER_SCHEDULE_CONFIGURATION_FAILED')
  let result
  try{result=await response.json()}catch{throw Error('REMINDER_SCHEDULE_RESULT_INVALID')}
  if(!result || typeof result!=='object' || Array.isArray(result) || result.enabled!==enabled || result.projectRef!==projectRef || (enabled ? !Number.isSafeInteger(result.jobId)||result.jobId<1 : result.jobId!==null&&(!Number.isSafeInteger(result.jobId)||result.jobId<1)))throw Error('REMINDER_SCHEDULE_RESULT_INVALID')
  return{environment,enabled:result.enabled,projectRef:result.projectRef,jobId:result.jobId}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [environment,operation,...extra]=process.argv.slice(2)
  try{
    if(extra.length||!['enable','disable'].includes(operation))throw Error('Expected staging|production enable|disable')
    console.log(JSON.stringify(await configureShopReminderSchedule({environment,enabled:operation==='enable',env:name=>process.env[name]})))
  }catch(error){console.error(error.message);process.exitCode=1}
}
