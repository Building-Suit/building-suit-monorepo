import{doctorProviderConfiguration}from'./authConfiguration.ts'
export function doctorAuthSetupReport(values:Record<string,string|undefined>,runtime=false){
 const fields=runtime?{APP_ENV:values.NUXT_PUBLIC_DOCTOR_AUTH_ENVIRONMENT,APP_URL:values.NUXT_PUBLIC_DOCTOR_AUTH_ORIGIN,DOCTOR_SUPABASE_URL:values.NUXT_PUBLIC_DOCTOR_AUTH_URL,DOCTOR_SUPABASE_PUBLISHABLE_KEY:values.NUXT_PUBLIC_DOCTOR_AUTH_KEY}:values
 const names=runtime?['NUXT_PUBLIC_DOCTOR_AUTH_URL','NUXT_PUBLIC_DOCTOR_AUTH_KEY']:['DOCTOR_SUPABASE_URL','DOCTOR_SUPABASE_PUBLISHABLE_KEY']
 const missing=names.filter(name=>!values[name]?.trim())
 const base={source:runtime?'built-server-runtime':'development-or-build',missing,explicitOrigin:Boolean(fields.APP_URL?.trim()),configured:false,marker:'not_checked' as string,status:'unconfigured',errorCode:null as string|null}
 if(runtime&&values.NUXT_PUBLIC_DOCTOR_AUTH_CONFIGURED!=='true')return{...base,status:values.NUXT_PUBLIC_DOCTOR_AUTH_CONFIGURED==='false'?'explicitly_disabled':'runtime_flag_required',missing:[...missing,'NUXT_PUBLIC_DOCTOR_AUTH_CONFIGURED=true']}
 try{const provider=doctorProviderConfiguration(fields);return{...base,configured:provider.enabled,status:provider.enabled?'configured_unverified':'unconfigured'}}
 catch(error){const code=error instanceof Error&&/^DOCTOR_[A-Z_]+$/.test(error.message)?error.message:'DOCTOR_CONFIGURATION_INVALID';return{...base,status:'invalid',errorCode:code}}
}
export async function doctorVerifyAuthSetup(values:Record<string,string|undefined>,runtime=false,request:typeof fetch=fetch){
 const report=doctorAuthSetupReport(values,runtime);if(!report.configured)return report
 const config=doctorProviderConfiguration(runtime?{APP_ENV:values.NUXT_PUBLIC_DOCTOR_AUTH_ENVIRONMENT,APP_URL:values.NUXT_PUBLIC_DOCTOR_AUTH_ORIGIN,DOCTOR_SUPABASE_URL:values.NUXT_PUBLIC_DOCTOR_AUTH_URL,DOCTOR_SUPABASE_PUBLISHABLE_KEY:values.NUXT_PUBLIC_DOCTOR_AUTH_KEY}:values)
 try{
  const response=await request(`${config.url}/rest/v1/rpc/doctor_runtime_contract`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{apikey:config.key,Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:'{}'})
  if(!response.ok)return{...report,status:'connection_unverified',marker:'request_rejected'}
  const value:unknown=await response.json()
  const valid=Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&'product'in value&&value.product==='doctor-suit'&&'version'in value&&value.version===1&&'data_mode'in value&&value.data_mode==='synthetic')
  return{...report,status:valid?'verified':'connection_unverified',marker:valid?'verified':'wrong_or_missing_marker'}
 }catch{return{...report,status:'connection_unverified',marker:'unreachable_or_invalid_response'}}
}
